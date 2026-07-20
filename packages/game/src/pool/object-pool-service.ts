import { Service } from "../context";

declare const PoolValue: unique symbol;

/** 对象池的复用、清理和保留策略。 */
export interface ObjectPoolOptions<T> {
    readonly name?: string;
    readonly maxRetained?: number;
    /** 每次 acquire 后恢复调用方需要的初始状态。 */
    readonly reset?: (value: T) => void;
    /** 每次 release 前清除外部引用。 */
    readonly clear?: (value: T) => void;
    /** 对象未保留或池被释放时执行最终清理。 */
    readonly dispose?: (value: T) => void;
}

/** 上层模块可公开或私有保存的类型安全池 token。 */
export interface ObjectPoolToken<T> {
    readonly name: string;
    readonly options: Readonly<ObjectPoolOptions<T>>;
    readonly [PoolValue]?: T;
}

/** 定义一个类型安全对象池 key；定义本身不创建池或对象。 */
export function definePool<T>(options: ObjectPoolOptions<T> = {}): ObjectPoolToken<T> {
    const normalized = normalizeOptions(options);
    return Object.freeze({
        name: normalized.name,
        options: Object.freeze(normalized),
    }) as ObjectPoolToken<T>;
}

/** 可由上层直接持有的通用对象池。 */
export class ObjectPool<T> {
    private readonly _values: T[] = [];
    private _disposed = false;
    readonly options: Readonly<Required<Pick<ObjectPoolOptions<T>, "name" | "maxRetained">> & ObjectPoolOptions<T>>;

    constructor(
        private readonly _factory: () => T,
        options: ObjectPoolOptions<T> = {},
    ) {
        if (typeof _factory !== "function") throw new TypeError("ObjectPool requires a factory");
        this.options = Object.freeze(normalizeOptions(options));
    }

    /** 取得复用对象；池为空时调用工厂。 */
    acquire(): T {
        this.assertAlive();
        const value = this._values.pop() ?? this._factory();
        this.options.reset?.(value);
        return value;
    }

    /** 清理并归还对象；超过保留上限时立即执行最终清理。 */
    release(value: T): void {
        this.assertAlive();
        this.options.clear?.(value);
        if (this._values.length < this.options.maxRetained) this._values.push(value);
        else this.options.dispose?.(value);
    }

    /** 当前空闲对象数量。 */
    get retained(): number { return this._values.length; }

    /** 在宿主空闲边界缩减保留对象。 */
    trim(retain = 0): void {
        this.assertAlive();
        requireRetainCount(retain);
        if (this.options.dispose) {
            while (this._values.length > retain) this.options.dispose(this._values.pop()!);
        } else if (this._values.length > retain) {
            this._values.length = retain;
        }
    }

    /** 释放全部空闲对象并终结池。 */
    dispose(): void {
        if (this._disposed) return;
        if (this.options.dispose) {
            for (let i = this._values.length - 1; i >= 0; i--) this.options.dispose(this._values[i]);
        }
        this._values.length = 0;
        this._disposed = true;
    }

    private assertAlive(): void {
        if (this._disposed) throw new Error(`ObjectPool ${this.options.name} has been disposed`);
    }
}

/** Game 默认提供的通用池化能力；池和 factory 都属于 Service 而不是 State。 */
export class ObjectPoolService extends Service {
    private readonly _keyed = new Map<ObjectPoolToken<unknown>, ObjectPool<unknown>>();
    private readonly _owned: ObjectPool<unknown>[] = [];

    /** 创建一个由当前 Service 统一释放、也可由调用方直接持有的池。 */
    create<T>(factory: () => T, options: ObjectPoolOptions<T> = {}): ObjectPool<T> {
        const pool = new ObjectPool(factory, options);
        this._owned.push(pool as ObjectPool<unknown>);
        return pool;
    }

    /** 为 token 绑定对象工厂；重复绑定立即报错。 */
    bind<T>(token: ObjectPoolToken<T>, factory: () => T): this {
        if (this._keyed.has(token as ObjectPoolToken<unknown>)) {
            throw new Error(`Object pool is already bound: ${token.name}`);
        }
        const pool = this.create(factory, token.options);
        this._keyed.set(token as ObjectPoolToken<unknown>, pool as ObjectPool<unknown>);
        return this;
    }

    /** 从已绑定 token 对应的池中取得对象。 */
    acquire<T>(token: ObjectPoolToken<T>): T { return this.requirePool(token).acquire(); }

    /** 把对象归还给已绑定 token 对应的池。 */
    release<T>(token: ObjectPoolToken<T>, value: T): void { this.requirePool(token).release(value); }

    /** 裁剪单个已绑定池。 */
    trim<T>(token: ObjectPoolToken<T>, retain = 0): void { this.requirePool(token).trim(retain); }

    dispose(): void {
        let firstError: unknown;
        for (let i = this._owned.length - 1; i >= 0; i--) {
            try { this._owned[i].dispose(); }
            catch (error) { firstError ??= error; }
        }
        this._owned.length = 0;
        this._keyed.clear();
        if (firstError !== undefined) throw firstError;
    }

    private requirePool<T>(token: ObjectPoolToken<T>): ObjectPool<T> {
        const pool = this._keyed.get(token as ObjectPoolToken<unknown>);
        if (!pool) throw new Error(`Object pool is not bound: ${token.name}`);
        return pool as ObjectPool<T>;
    }
}

function normalizeOptions<T>(
    options: ObjectPoolOptions<T>,
): Required<Pick<ObjectPoolOptions<T>, "name" | "maxRetained">> & ObjectPoolOptions<T> {
    const maxRetained = options.maxRetained ?? Number.MAX_SAFE_INTEGER;
    requireRetainCount(maxRetained);
    return { ...options, name: options.name ?? "anonymous", maxRetained };
}

function requireRetainCount(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError("retain count must be a non-negative safe integer");
    }
}
