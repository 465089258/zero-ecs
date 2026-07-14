import { injectionEntries, InjectionKind } from "./injection-metadata";
import {
    Resource,
    type ResourceType,
    Service,
    type ServiceType,
    State,
    type StateType,
} from "./types";

/** 保存启动前传入的 Resource 实例，并在构建后锁定。 */
export class ResourceContainer {
    private readonly _items = new Map<ResourceType, Resource>();
    private _locked = false;

    /** 注册 Resource 实例；重复注册或容器锁定后会抛出错误。 */
    add<T extends Resource>(type: ResourceType<T>, instance: T): this {
        if (this._locked) throw new Error("Resources are locked");
        if (this._items.has(type)) throw new Error(`Resource already registered: ${type.name}`);
        this._items.set(type, instance);
        return this;
    }

    /** 获取指定 Resource；未注册时抛出错误。 */
    get<T extends Resource>(type: ResourceType<T>): T {
        const value = this._items.get(type);
        if (!value) throw new Error(`Resource not found: ${type.name}`);
        return value as T;
    }

    /** 判断是否已注册指定 Resource。 */
    has(type: ResourceType): boolean { return this._items.has(type); }
    /** 禁止继续注册 Resource。 */
    lock(): void { this._locked = true; }
    /** 清空所有 Resource 引用。 */
    clear(): void { this._items.clear(); }
}

/** 创建并保存 State，按注入依赖顺序管理其生命周期。 */
export class StateContainer {
    private readonly _items = new Map<StateType, State>();
    private readonly _order: State[] = [];
    private _locked = false;
    private _initialized = false;
    private _lifecycleOrder: State[] = [];

    /** 创建并注册 State；重复注册或容器锁定后会抛出错误。 */
    add<T extends State>(type: StateType<T>): T {
        if (this._locked) throw new Error("States are locked");
        if (this._items.has(type)) throw new Error(`State already registered: ${type.name}`);
        const value = new type();
        this._items.set(type, value);
        this._order.push(value);
        return value;
    }

    /** 获取指定 State；未注册时抛出错误。 */
    get<T extends State>(type: StateType<T>): T {
        const value = this._items.get(type);
        if (!value) throw new Error(`State not found: ${type.name}`);
        return value as T;
    }

    /** 判断是否已注册指定 State。 */
    has(type: StateType): boolean { return this._items.has(type); }
    /** 按注册顺序返回全部 State。 */
    values(): readonly State[] { return this._order; }
    /** 禁止继续注册 State。 */
    lock(): void { this._locked = true; }

    /** 按 State 注入依赖的拓扑顺序执行初始化钩子。 */
    init(): void {
        if (this._initialized) return;
        const order = initializationOrder(this._order, InjectionKind.State, "State");
        this._lifecycleOrder = order;
        for (const value of order) {
            value.init?.();
        }
        this._initialized = true;
    }

    /** 按初始化逆序执行释放钩子并清空容器。 */
    dispose(): void {
        let firstError: unknown;
        const order = this._lifecycleOrder.length > 0 ? this._lifecycleOrder : this._order;
        for (let i = order.length - 1; i >= 0; i--) {
            try { order[i].dispose?.(); }
            catch (error) { firstError ??= error; }
        }
        this._lifecycleOrder = [];
        this._order.length = 0;
        this._items.clear();
        this._locked = false;
        this._initialized = false;
        if (firstError !== undefined) throw firstError;
    }
}

/** 创建并保存 Service，按注入依赖顺序管理其生命周期。 */
export class ServiceContainer {
    private readonly _items = new Map<ServiceType, Service>();
    private readonly _order: Service[] = [];
    private _locked = false;
    private _initialized = false;
    private _lifecycleOrder: Service[] = [];

    /** 创建并注册 Service；重复注册或容器锁定后会抛出错误。 */
    add<T extends Service>(type: ServiceType<T>): T {
        if (this._locked) throw new Error("Services are locked");
        if (this._items.has(type)) throw new Error(`Service already registered: ${type.name}`);
        const value = new type();
        this._items.set(type, value);
        this._order.push(value);
        return value;
    }

    /** 获取指定 Service；未注册时抛出错误。 */
    get<T extends Service>(type: ServiceType<T>): T {
        const value = this._items.get(type);
        if (!value) throw new Error(`Service not found: ${type.name}`);
        return value as T;
    }

    /** 判断是否已注册指定 Service。 */
    has(type: ServiceType): boolean { return this._items.has(type); }
    /** 按注册顺序返回全部 Service。 */
    values(): readonly Service[] { return this._order; }
    /** 禁止继续注册 Service。 */
    lock(): void { this._locked = true; }

    /** 按 Service 注入依赖的拓扑顺序执行初始化钩子。 */
    init(): void {
        if (this._initialized) return;
        const order = initializationOrder(this._order, InjectionKind.Service, "Service");
        this._lifecycleOrder = order;
        for (const value of order) {
            value.init?.();
        }
        this._initialized = true;
    }

    /** 按初始化逆序执行释放钩子并清空容器。 */
    dispose(): void {
        let firstError: unknown;
        const order = this._lifecycleOrder.length > 0 ? this._lifecycleOrder : this._order;
        for (let i = order.length - 1; i >= 0; i--) {
            try { order[i].dispose?.(); }
            catch (error) { firstError ??= error; }
        }
        this._lifecycleOrder = [];
        this._order.length = 0;
        this._items.clear();
        this._locked = false;
        this._initialized = false;
        if (firstError !== undefined) throw firstError;
    }
}

function initializationOrder<T extends State | Service>(
    values: readonly T[],
    dependencyKind: InjectionKind,
    label: string,
): T[] {
    const indexes = new Map<Function, number>();
    values.forEach((value, index) => indexes.set(value.constructor, index));
    const outgoing = values.map(() => [] as number[]);
    const inDegree = new Uint32Array(values.length);

    values.forEach((value, dependent) => {
        let ctor = value.constructor as Function;
        const seen = new Set<number>();
        while (ctor && ctor !== Function.prototype) {
            const entries = injectionEntries(ctor);
            if (entries) for (const entry of entries) {
                if (entry.kind !== dependencyKind || !entry.type) continue;
                const dependency = indexes.get(entry.type);
                if (dependency === undefined || seen.has(dependency)) continue;
                seen.add(dependency);
                outgoing[dependency].push(dependent);
                inDegree[dependent]++;
            }
            ctor = Object.getPrototypeOf(ctor);
        }
    });

    const result: T[] = [];
    const emitted = new Uint8Array(values.length);
    while (result.length < values.length) {
        let next = -1;
        for (let i = 0; i < values.length; i++) {
            if (!emitted[i] && inDegree[i] === 0) { next = i; break; }
        }
        if (next === -1) {
            const names = values
                .filter((_, index) => !emitted[index])
                .map(value => value.constructor.name)
                .join(" -> ");
            throw new Error(`${label} initialization dependency cycle: ${names}`);
        }
        emitted[next] = 1;
        result.push(values[next]);
        for (const dependent of outgoing[next]) inDegree[dependent]--;
    }
    return result;
}
