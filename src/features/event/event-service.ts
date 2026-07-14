import { ErrorHandlerService } from "../../context/error-handler-service";
import { Service } from "../../context/types";
import { Listener } from "./listener";
type Fn<T extends EventArgs> = (args: T) => void;
type ArgsType<T extends EventArgs = EventArgs> = new () => T;
/** 事件创建与监听服务的公共接口。 */
export interface IEventService {
    /** 获取指定类型的可发布事件参数；实例可能来自对象池。 */
    event<T extends EventArgs>(type: ArgsType<T>): Omit<T, "_reset" | "_recycle">;
    /** 注册持久监听器。 */
    on<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
    /** 注册触发一次后自动移除的监听器。 */
    one<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
    /** 删除最后一个函数与上下文均匹配的监听器。 */
    off<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
}

const enum EventFlags {
    Mutable = 0,
    Posted = 1 << 0,
    Recycled = 1 << 1,
}

/** 可池化、需要显式发布的事件参数基类。 */
export abstract class EventArgs {
    private _post!: (args: EventArgs) => void;
    private _flags = EventFlags.Recycled;

    /** @internal EventService 的对象池重置入口。 */
    _reset(post: (args: EventArgs) => void): void {
        if (this._flags !== EventFlags.Recycled) {
            throw new Error(`${this.constructor.name} cannot be reset before it is recycled`);
        }
        this._post = post;
        this._flags = EventFlags.Mutable;
    }

    /** 将事件加入延迟分发队列；发布后不可再修改或重复发布。 */
    post(): void {
        if (this._flags === EventFlags.Posted) {
            throw new Error(`${this.constructor.name} has already been posted`);
        }
        if (this._flags === EventFlags.Recycled) {
            throw new Error(`${this.constructor.name} has already been recycled`);
        }
        this._flags = EventFlags.Posted;
        try {
            this._post(this);
        } catch (error) {
            this._flags = EventFlags.Mutable;
            throw error;
        }
    }

    /** @internal EventService 的对象池回收入口。 */
    _recycle(): void {
        if (this._flags !== EventFlags.Posted) {
            throw new Error(`${this.constructor.name} is not posted`);
        }
        try {
            this.clear?.();
        } finally {
            this._flags = EventFlags.Recycled;
        }
    }

    /** 校验事件参数仍处于可修改状态。 */
    protected assertMutable(): void {
        if (this._flags === EventFlags.Posted) {
            throw new Error(`${this.constructor.name} has already been posted`);
        }
        if (this._flags === EventFlags.Recycled) {
            throw new Error(`${this.constructor.name} has already been recycled`);
        }
    }

    /** 回收前清理子类字段。 */
    clear?(): void;
}

/** 管理事件对象池、监听器与延迟分发队列。 */
export class EventService extends Service implements IEventService {
    @Service.inject(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    private readonly _events: Map<ArgsType, Listener<EventArgs>> = new Map();
    private readonly _pool: Map<ArgsType, EventArgs[]> = new Map();
    private _frontQueue: Array<EventArgs> = [];
    private _backQueue: Array<EventArgs> = [];
    private readonly _boundPost = (args: EventArgs): void => { this.boundPost(args); };
    private readonly _listenerError = (error: unknown): void => { this.onError(error); };
    private _disposed = false;

    /**
     * @internal 在内部 Post 阶段分发当前队列并回收事件。
     * 监听器执行期间新发布的事件会留到下一次 Flush。
     */
    flush(): void {
        this.assertUsable();
        const { _frontQueue, _backQueue: queue } = this;
        this._frontQueue = queue;
        this._backQueue = _frontQueue;
        const events = this._events;
        for (let i = 0; i < queue.length; i++) {
            const args = queue[i];
            try {
                const type = args.constructor;
                events.get(type as ArgsType)?.call(args, this._listenerError);
            } finally {
                try {
                    args._recycle();
                } catch (error) {
                    this.onError(error, args);
                } finally {
                    this.recycle(args);
                }
            }
        }
        queue.length = 0;
    }

    /** 获取可修改的事件参数实例；调用方设置字段后必须显式 `post()`。 */
    event<T extends EventArgs>(type: ArgsType<T>): Omit<T, "_reset" | "_recycle"> {
        this.assertUsable();
        let pool = this._pool.get(type);
        let instance: T;
        if (pool && pool.length > 0) {
            instance = pool.pop() as T;
        } else {
            instance = new type();
        }
        instance._reset(this._boundPost);
        return instance;
    }

    private boundPost(args: EventArgs): void {
        this.assertUsable();
        this._backQueue.push(args);
    }
    private recycle(cmd: EventArgs): void {
        // 获取命令类型对应的池
        const type = cmd.constructor as ArgsType; // 需要命令类暴露静态 type
        let pool = this._pool.get(type);
        if (!pool) {
            pool = [];
            this._pool.set(type, pool);
        }
        pool.push(cmd);
    }
    /** 注册持久监听器。 */
    on<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this {
        const events = this._events;
        let listener = events.get(type);
        if (!listener) {
            listener = new Listener();
            events.set(type, listener);
        }
        listener.on(callback as Fn<EventArgs>, context);
        return this;
    }

    /** 注册触发一次后自动移除的监听器。 */
    one<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this {
        const events = this._events;
        let listener = events.get(type);
        if (!listener) {
            listener = new Listener();
            events.set(type, listener);
        }
        listener.one(callback as Fn<EventArgs>, context);
        return this;
    }

    /** 删除最后一个函数与上下文均匹配的监听器。 */
    off<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this {
        let listener = this._events.get(type);
        if (!listener) return this;
        listener.off(callback as Fn<EventArgs>, context);
        return this;
    }

    /** 将每种事件类型的空闲对象池裁剪到指定保留数量。 */
    trimPools(retainPerType = 0): void {
        this.assertUsable();
        if (!Number.isSafeInteger(retainPerType) || retainPerType < 0) {
            throw new RangeError("retainPerType must be a non-negative safe integer");
        }
        for (const pool of this._pool.values()) {
            if (pool.length > retainPerType) pool.length = retainPerType;
        }
    }

    /** 回收待分发事件并释放全部监听器与对象池。 */
    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        let firstError = this.releaseQueue(this._frontQueue);
        const secondError = this.releaseQueue(this._backQueue);
        firstError ??= secondError;
        this._events.clear();
        this._pool.clear();
        if (firstError !== undefined) throw firstError;
    }

    /** 事件监听或回收失败时的统一错误入口。 */
    protected onError(error: unknown, _args?: EventArgs): void {
        this._errors.report(error, "event", _args);
    }

    private releaseQueue(queue: EventArgs[]): unknown {
        let firstError: unknown;
        for (let i = 0; i < queue.length; i++) {
            try { queue[i]._recycle(); }
            catch (error) {
                try { this.onError(error, queue[i]); }
                catch (handlerError) { firstError ??= handlerError; }
            }
        }
        queue.length = 0;
        return firstError;
    }

    private assertUsable(): void {
        if (this._disposed) throw new Error("EventService has been disposed");
    }
}
