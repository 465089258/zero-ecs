import { ErrorHandlerService } from "../../context/error-handler-service";
import { Service } from "../../context/types";
import { Listener } from "./listener";
type Fn<T extends EventArgs> = (args: T) => void;
type ArgsType<T extends EventArgs = EventArgs> = new () => T;
export interface IEventService {
    event<T extends EventArgs>(type: ArgsType<T>): Omit<T, "_reset" | "_recycle">;
    on<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
    one<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
    off<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
}

const enum EventFlags {
    Mutable = 0,
    Posted = 1 << 0,
    Recycled = 1 << 1,
}

export abstract class EventArgs {
    private _post!: (args: EventArgs) => void;
    private _flags = EventFlags.Recycled;

    /** @internal EventService pool hook. */
    _reset(post: (args: EventArgs) => void): void {
        if (this._flags !== EventFlags.Recycled) {
            throw new Error(`${this.constructor.name} cannot be reset before it is recycled`);
        }
        this._post = post;
        this._flags = EventFlags.Mutable;
    }

    /** 把事件发布到事件系统中 */
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

    /** @internal EventService pool hook. */
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

    protected assertMutable(): void {
        if (this._flags === EventFlags.Posted) {
            throw new Error(`${this.constructor.name} has already been posted`);
        }
        if (this._flags === EventFlags.Recycled) {
            throw new Error(`${this.constructor.name} has already been recycled`);
        }
    }

    clear?(): void;
}

/** 事件系统类 */
export class EventService extends Service implements IEventService {
    @Service.inject(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    private readonly _events: Map<ArgsType, Listener<EventArgs>> = new Map();
    private readonly _pool: Map<ArgsType, EventArgs[]> = new Map();
    private _frontQueue: Array<EventArgs> = [];
    private _backQueue: Array<EventArgs> = [];
    private readonly _boundPost = (args: EventArgs): void => { this.boundPost(args); };
    private readonly _listenerError = (error: unknown): void => { this.onError(error); };
    private _disposed = false;

    /** @internal Internal Post hook. */
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
    /** 添加监听器 */
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

    /** 添加单次监听器 */
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

    /** 删除监听器 注意只删除最后一个匹配项 */
    off<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this {
        let listener = this._events.get(type);
        if (!listener) return this;
        listener.off(callback as Fn<EventArgs>, context);
        return this;
    }

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
