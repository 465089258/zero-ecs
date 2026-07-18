import { injectionEntries } from "../injection-metadata";
import { AbsClassType, ClassType } from "./types";

function initializationOrder<T>(
    values: readonly T[],
    key: symbol,
    dynamicDependencies?: ReadonlyMap<T, ReadonlySet<T>>,
): T[] {
    const indexes = new Map<Function, number>();
    const valueIndexes = new Map<T, number>();
    values.forEach((value, index) => indexes.set(Object.getPrototypeOf(value).constructor, index));
    values.forEach((value, index) => valueIndexes.set(value, index));
    const outgoing = values.map(() => [] as number[]);
    const inDegree = new Uint32Array(values.length);

    values.forEach((value, dependent) => {
        let ctor = Object.getPrototypeOf(value).constructor as Function;
        const seen = new Set<number>();
        while (ctor && ctor !== Function.prototype) {
            const entries = injectionEntries(ctor, key);
            if (entries) for (const entry of entries) {
                if (!entry.type) continue;
                const dependency = indexes.get(entry.type);
                if (dependency === undefined || seen.has(dependency)) continue;
                seen.add(dependency);
                outgoing[dependency].push(dependent);
                inDegree[dependent]++;
            }
            ctor = Object.getPrototypeOf(ctor);
        }
        const dynamic = dynamicDependencies?.get(value);
        if (dynamic) for (const dependencyValue of dynamic) {
            const dependency = valueIndexes.get(dependencyValue);
            if (dependency === undefined || seen.has(dependency)) continue;
            seen.add(dependency);
            outgoing[dependency].push(dependent);
            inDegree[dependent]++;
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
                .map(value => Object.getPrototypeOf(value).constructor.name)
                .join(" -> ");
            throw new Error(`initialization dependency cycle: ${names}`);
        }
        emitted[next] = 1;
        result.push(values[next]);
        for (const dependent of outgoing[next]) inDegree[dependent]--;
    }
    return result;
}
type Type<T> = ClassType<T> | AbsClassType<T>;
/** 创建并保存 State，按注入依赖顺序管理其生命周期。 */
export class BasicContainer<T> {
    protected readonly items = new Map<Type<T>, T>();
    protected readonly order: T[] = [];
    protected sealed = false;
    protected initialized = false;
    protected lifecycleOrder: T[] = [];

    constructor(protected readonly symbol: symbol) { }

    /** 注册 Resource 实例；重复注册或容器锁定后会抛出错误。 */
    set<I extends T>(type: Type<I>, instance: I): this {
        if (this.sealed) throw new Error("Resources are locked");
        if (this.items.has(type)) throw new Error(`Resource already registered: ${type.name}`);
        this.items.set(type, instance);
        return this;
    }

    /** 获取指定 State；未注册时抛出错误。 */
    get<I extends T>(type: Type<I>): I {
        const value = this.items.get(type);
        if (!value) throw new Error(`State not found: ${type.name}`);
        return value as I;
    }

    /** 判断是否已注册指定 State。 */
    has<I extends T>(type: Type<I>): boolean { return this.items.has(type); }

    /** 按注册顺序返回全部 State。 */
    values(): readonly T[] { return this.order; }

    /** 禁止继续注册 State。 */
    lock(): void { this.sealed = true; }

    /** 按 State 注入依赖的拓扑顺序执行初始化钩子。 */
    init(): void {
        if (this.initialized) return;
        this.refreshLifecycleOrder();
        const order = this.lifecycleOrder;
        this.doInit?.(order);
        this.initialized = true;
    }

    protected doInit?(order: T[]): void;

    /** 按初始化逆序执行释放钩子并清空容器。 */
    dispose(): void {
        let firstError: unknown;
        const order = this.lifecycleOrder.length > 0 ? this.lifecycleOrder : this.order;
        try {
            this.doDispose?.(order);
        } catch (error) {
            firstError ??= error;
        }
        this.lifecycleOrder = [];
        this.order.length = 0;
        this.items.clear();
        this.sealed = false;
        this.initialized = false;
        if (firstError !== undefined) throw firstError;
    }

    protected doDispose?(order: T[]): void;

    /** 结合静态注入和可选动态依赖重新计算生命周期顺序。 */
    protected refreshLifecycleOrder(dynamicDependencies?: ReadonlyMap<T, ReadonlySet<T>>): void {
        this.lifecycleOrder = initializationOrder(this.order, this.symbol, dynamicDependencies);
    }


    /** @internal 按元数据向实例写入依赖。 */
    injectAll(instance: any): void {
        let ctor = instance.constructor;
        while (ctor && ctor !== Function.prototype) {
            const entries = injectionEntries(ctor, this.symbol);
            if (entries) for (const entry of entries) {
                if (instance[entry.property] !== undefined) continue;
                instance[entry.property] = this.get(entry.type as ClassType<T>);
            }
            ctor = Object.getPrototypeOf(ctor);
        }
    }

    /** @internal 判断实例是否声明了此容器类型的依赖。 */
    hasInjection(instance: any): boolean {
        let ctor = instance.constructor;
        while (ctor && ctor !== Function.prototype) {
            if (injectionEntries(ctor, this.symbol)?.length) return true;
            ctor = Object.getPrototypeOf(ctor);
        }
        return false;
    }
}
