export type CommandSubmit = (command: Command) => void;

export type CommandType<T extends Command = Command> = new (submit: CommandSubmit) => T;

const enum CommandFlags {
    Mutable = 0,
    Submitted = 1 << 0,
    Recycled = 1 << 1,
    LifecycleMask = Submitted | Recycled,
}

export interface ICommand {
    submit(): void;
}

/** Base class for pooled, explicitly submitted commands. */
export abstract class Command implements ICommand {
    protected _flags = CommandFlags.Recycled;

    constructor(private _submit: CommandSubmit) {}

    submit(): void {
        this.assertMutable();
        this._flags |= CommandFlags.Submitted;
        this._submit(this);
    }

    /** @internal CommandService pool hook. */
    reset(submit: CommandSubmit): void {
        if ((this._flags & CommandFlags.LifecycleMask) !== CommandFlags.Recycled) {
            throw new Error(`${this.constructor.name} cannot be reset before it is recycled`);
        }
        this._submit = submit;
        this._flags = CommandFlags.Mutable;
    }

    /** @internal CommandService execution hook. */
    _execute(): void {
        if ((this._flags & CommandFlags.LifecycleMask) !== CommandFlags.Submitted) {
            throw new Error(`${this.constructor.name} is not submitted`);
        }
        this.execute();
    }

    /** @internal CommandService pool hook. */
    _recycle(): void {
        try {
            this.clear?.();
        } finally {
            this._flags = CommandFlags.Recycled;
        }
    }

    protected assertMutable(): void {
        if ((this._flags & CommandFlags.LifecycleMask) === CommandFlags.Submitted) {
            throw new Error(`${this.constructor.name} has already been submitted`);
        }
        if ((this._flags & CommandFlags.LifecycleMask) === CommandFlags.Recycled) {
            throw new Error(`${this.constructor.name} has already been recycled`);
        }
    }

    protected clear?(): void;
    abstract execute(): void;
}
