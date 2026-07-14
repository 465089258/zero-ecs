import { InjectionService } from "../../context/injection-service";
import { Service } from "../../context/types";
import { EntityService, type Entity } from "../entity/entity-service";
import { Command, type CommandType } from "./command";
import { EntityCommand } from "./entity-command";

export interface ICommandService {
    cmd<T extends Command>(type: CommandType<T>): Omit<T, "execute">;
}

/** Owns the single pooled queue used by ordinary and entity commands. */
export class CommandService extends Service implements ICommandService {
    @Service.inject(InjectionService) private readonly _injection!: InjectionService;
    @Service.inject(EntityService) private readonly _entities!: EntityService;

    private readonly _pools = new Map<CommandType, Command[]>();
    private _pending: Command[] = [];
    private _pendingUsed = 0;
    private _processing: Command[] = [];
    private readonly _submit = (command: Command): void => { this.enqueue(command); };

    cmd<T extends Command>(type: CommandType<T>): Omit<T, "execute"> {
        let pool = this._pools.get(type);
        if (!pool) {
            pool = [];
            this._pools.set(type, pool);
        }
        let command = pool.pop() as T | undefined;
        if (!command) {
            command = new type(this._submit);
            this._injection.inject(command);
        }
        command.reset(this._submit);
        return command;
    }

    /** Creates a command for an existing entity. The caller must submit it. */
    entity(entity: Entity): Omit<EntityCommand, "execute"> {
        const command = this.cmd(EntityCommand) as unknown as EntityCommand;
        command.bind(entity);
        return command;
    }

    /** Immediately reserves an Entity ID and returns its unsubmitted command. */
    spawn(): Omit<EntityCommand, "execute"> {
        return this.entity(this._entities.spawn());
    }

    flush(): void {
        let batches = 0;
        while (this._pendingUsed > 0 && batches++ < 1000) {
            const commands = this._pending;
            const used = this._pendingUsed;
            this._pending = this._processing;
            this._pendingUsed = 0;
            this._processing = commands;

            for (let i = 0; i < used; i++) {
                const command = commands[i];
                try {
                    command._execute();
                } catch (error) {
                    this.onError(error, command);
                } finally {
                    try {
                        command._recycle();
                    } catch (error) {
                        this.onError(error, command);
                    } finally {
                        this.recycle(command);
                    }
                }
            }
        }

        if (this._pendingUsed > 0) {
            const used = this._pendingUsed;
            this._pendingUsed = 0;
            for (let i = 0; i < used; i++) {
                const command = this._pending[i];
                try { command._recycle(); }
                finally { this.recycle(command); }
            }
            this.onError(new Error("CommandService flush safety limit reached"));
        }
    }

    protected onError(error: unknown, _command?: Command): void {
        console.error(error);
    }

    private enqueue(command: Command): void {
        const index = this._pendingUsed++;
        if (index < this._pending.length) this._pending[index] = command;
        else this._pending.push(command);
    }

    private recycle(command: Command): void {
        const type = command.constructor as CommandType;
        let pool = this._pools.get(type);
        if (!pool) {
            pool = [];
            this._pools.set(type, pool);
        }
        pool.push(command);
    }
}
