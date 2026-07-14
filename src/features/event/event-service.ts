import { Service } from "../../context/types";
import { Listener } from "./listener";
type Fn<T extends EventArgs> = (args: T) => void;
type ArgsType<T extends EventArgs = EventArgs> = new () => T;
export interface IEventService {
    event<T extends EventArgs>(type: ArgsType<T>): Omit<T, "reset">;
    on<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
    one<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
    off<T extends EventArgs>(type: ArgsType<T>, callback: Fn<T>, context?: any): this;
}

export abstract class EventArgs {
    private _post!: (args: EventArgs) => void;
    reset(post: (args: EventArgs) => void) {
        this._post = post;
    }

    /** 把事件发布到事件系统中 */
    post() {
        this._post(this);
    }
    clear?(): void;
}

/** 事件系统类 */
export class EventService extends Service implements IEventService {
    readonly events: Map<ArgsType, Listener<EventArgs>> = new Map();
    private readonly _pool: Map<ArgsType, EventArgs[]> = new Map();
    private _frontQueue: Array<EventArgs> = [];
    private _backQueue: Array<EventArgs> = [];
    private _boundPost!: (args: EventArgs) => void;
    init() {
        this._boundPost = this.boundPost.bind(this);
    }
    flush(): void {
        const { _frontQueue, _backQueue: queue } = this;
        this._frontQueue = queue;
        this._backQueue = _frontQueue;
        const events = this.events;
        const emitters = this._pool;
        for (let i = 0; i < queue.length; i++) {
            const args = queue[i];
            const type = args.constructor;
            events.get(type as ArgsType)?.call(args)
            args.clear?.();
            this.recycle(args);
        }
        queue.length = 0;
    }

    event<T extends EventArgs>(type: ArgsType<T>): Omit<T, "reset"> {
        let pool = this._pool.get(type);
        let instance: T;
        if (pool && pool.length > 0) {
            instance = pool.pop() as T;
        } else {
            instance = new type();
        }
        instance.reset(this._boundPost);
        return instance;
    }

    private boundPost(args: EventArgs) {
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
        const events = this.events;
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
        const events = this.events;
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
        let listener = this.events.get(type);
        if (!listener) return this;
        listener.off(callback as Fn<EventArgs>, context);
        return this;
    }

    dispose(): void {
        this.events.clear();
        this._pool.clear();
        this._frontQueue.length = 0;
        this._backQueue.length = 0;
    }
}
