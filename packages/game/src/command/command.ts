/** 将命令提交到所属 Commands Service 的回调。 */
export type CommandSubmit = (command: Command) => void;

/** 可由 Commands 创建并池化的命令类。 */
export type CommandType<T extends Command = Command> = new (submit: CommandSubmit) => T;

const enum CommandFlags {
    Mutable = 0,
    Submitted = 1 << 0,
    Recycled = 1 << 1,
    LifecycleMask = Submitted | Recycled,
}

/** 可显式提交的命令。 */
export interface ICommand {
    submit(): void;
}

/** 可池化、需要显式提交的命令基类。 */
export abstract class Command implements ICommand {
    protected _flags = CommandFlags.Recycled;

    constructor(private _submit: CommandSubmit) {}

    /**
     * 将命令加入延迟执行队列。
     *
     * 命令提交后不可再修改，也不可重复提交。
     */
    submit(): void {
        this.assertMutable();
        this._flags |= CommandFlags.Submitted;
        this._submit(this);
    }

    /** @internal Commands 的对象池重置入口。 */
    reset(submit: CommandSubmit): void {
        if ((this._flags & CommandFlags.LifecycleMask) !== CommandFlags.Recycled) {
            throw new Error(`${this.constructor.name} cannot be reset before it is recycled`);
        }
        this._submit = submit;
        this._flags = CommandFlags.Mutable;
    }

    /** @internal Commands 的执行入口。 */
    _execute(): void {
        if ((this._flags & CommandFlags.LifecycleMask) !== CommandFlags.Submitted) {
            throw new Error(`${this.constructor.name} is not submitted`);
        }
        this.execute();
    }

    /** @internal Commands 的对象池回收入口。 */
    _recycle(): void {
        try {
            this.clear?.();
        } finally {
            this._flags = CommandFlags.Recycled;
        }
    }

    /** 校验命令仍处于可修改状态。 */
    protected assertMutable(): void {
        if ((this._flags & CommandFlags.LifecycleMask) === CommandFlags.Submitted) {
            throw new Error(`${this.constructor.name} has already been submitted`);
        }
        if ((this._flags & CommandFlags.LifecycleMask) === CommandFlags.Recycled) {
            throw new Error(`${this.constructor.name} has already been recycled`);
        }
    }

    /** 回收前清理子类状态。 */
    protected clear?(): void;
    /** 执行命令；由 Commands 在内部提交阶段调用。 */
    abstract execute(): void;
}
