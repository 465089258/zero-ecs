import { injectionEntries, InjectionKind } from "./injection-metadata";
import {
    Resource,
    type ResourceType,
    Service,
    type ServiceType,
    State,
    type StateType,
} from "./types";

export class ResourceContainer {
    private readonly _items = new Map<ResourceType, Resource>();
    private _locked = false;

    add<T extends Resource>(type: ResourceType<T>, instance: T): this {
        if (this._locked) throw new Error("Resources are locked");
        if (this._items.has(type)) throw new Error(`Resource already registered: ${type.name}`);
        this._items.set(type, instance);
        return this;
    }

    get<T extends Resource>(type: ResourceType<T>): T {
        const value = this._items.get(type);
        if (!value) throw new Error(`Resource not found: ${type.name}`);
        return value as T;
    }

    has(type: ResourceType): boolean { return this._items.has(type); }
    lock(): void { this._locked = true; }
    clear(): void { this._items.clear(); }
}

export class StateContainer {
    private readonly _items = new Map<StateType, State>();
    private readonly _order: State[] = [];
    private _locked = false;
    private _initialized = false;

    add<T extends State>(type: StateType<T>): T {
        if (this._locked) throw new Error("States are locked");
        if (this._items.has(type)) throw new Error(`State already registered: ${type.name}`);
        const value = new type();
        this._items.set(type, value);
        this._order.push(value);
        return value;
    }

    get<T extends State>(type: StateType<T>): T {
        const value = this._items.get(type);
        if (!value) throw new Error(`State not found: ${type.name}`);
        return value as T;
    }

    has(type: StateType): boolean { return this._items.has(type); }
    values(): readonly State[] { return this._order; }
    lock(): void { this._locked = true; }

    init(): void {
        if (this._initialized) return;
        for (const value of initializationOrder(this._order, InjectionKind.State, "State")) {
            value.init?.();
        }
        this._initialized = true;
    }

    dispose(): void {
        for (let i = this._order.length - 1; i >= 0; i--) this._order[i].dispose?.();
        this._order.length = 0;
        this._items.clear();
        this._locked = false;
        this._initialized = false;
    }
}

export class ServiceContainer {
    private readonly _items = new Map<ServiceType, Service>();
    private readonly _order: Service[] = [];
    private _locked = false;
    private _initialized = false;

    add<T extends Service>(type: ServiceType<T>): T {
        if (this._locked) throw new Error("Services are locked");
        if (this._items.has(type)) throw new Error(`Service already registered: ${type.name}`);
        const value = new type();
        this._items.set(type, value);
        this._order.push(value);
        return value;
    }

    get<T extends Service>(type: ServiceType<T>): T {
        const value = this._items.get(type);
        if (!value) throw new Error(`Service not found: ${type.name}`);
        return value as T;
    }

    has(type: ServiceType): boolean { return this._items.has(type); }
    values(): readonly Service[] { return this._order; }
    lock(): void { this._locked = true; }

    init(): void {
        if (this._initialized) return;
        for (const value of initializationOrder(this._order, InjectionKind.Service, "Service")) {
            value.init?.();
        }
        this._initialized = true;
    }

    dispose(): void {
        for (let i = this._order.length - 1; i >= 0; i--) this._order[i].dispose?.();
        this._order.length = 0;
        this._items.clear();
        this._locked = false;
        this._initialized = false;
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
