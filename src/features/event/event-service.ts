import { ErrorHandlerService } from "../../context/error-handler-service";
import { Service } from "../../context/service";
import { State } from "../../context/state";
import type { Mut } from "../../schedule/system";
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

/** 事件监听、队列与对象池状态。 */
export class EventState extends State {
    readonly events = new Map<ArgsType, Listener<EventArgs>>();
    readonly frontQueue: EventArgs[] = [];
    readonly backQueue: EventArgs[] = [];
    readonly disposed: boolean = false;
}

/** @internal 当前 World 的事件参数对象池；不属于可恢复模拟状态。 */
export class EventPoolService extends Service {
    private readonly _pools = new Map<ArgsType, EventArgs[]>();

    acquire<T extends EventArgs>(type: ArgsType<T>, post: (args: EventArgs) => void): T {
        const pool = this._pools.get(type);
        const instance = pool && pool.length > 0 ? pool.pop() as T : new type();
        instance._reset(post);
        return instance;
    }

    recycle(args: EventArgs): void {
        const type = args.constructor as ArgsType;
        let pool = this._pools.get(type);
        if (!pool) {
            pool = [];
            this._pools.set(type, pool);
        }
        pool.push(args);
    }

    trim(retainPerType: number): void {
        for (const pool of this._pools.values()) {
            if (pool.length > retainPerType) pool.length = retainPerType;
        }
    }

    dispose(): void { this._pools.clear(); }
}

/** 管理事件对象池、监听器与延迟分发队列。 */
export class EventService extends Service implements IEventService {
    @Service.inject(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    @Service.inject(EventPoolService) private readonly _pool!: EventPoolService;
    @State.inject(EventState) private readonly _state!: Mut<EventState>;
    private readonly _boundPost = (args: EventArgs): void => { this.boundPost(args); };

    /** 获取可修改的事件参数实例；调用方设置字段后必须显式 `post()`。 */
    event<T extends EventArgs>(type: ArgsType<T>): Omit<T, "_reset" | "_recycle"> {
        this.assertUsable();
        return this._pool.acquire(type, this._boundPost);
    }

    private boundPost(args: EventArgs): void {
        this.assertUsable();
        this._state.backQueue.push(args);
    }

    /** 注册持久监听器。 */
    on<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this {
        const events = this._state.events;
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
        const events = this._state.events;
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
        let listener = this._state.events.get(type);
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
        this._pool.trim(retainPerType);
    }

    /** 回收待分发事件并释放全部监听器与对象池。 */
    dispose(): void {
        const state = this._state;
        if (state.disposed) return;
        state.disposed = true;
        let firstError = this.releaseQueue(state.frontQueue);
        const secondError = this.releaseQueue(state.backQueue);
        firstError ??= secondError;
        state.events.clear();
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
        if (this._state.disposed) throw new Error("EventService has been disposed");
    }
}
