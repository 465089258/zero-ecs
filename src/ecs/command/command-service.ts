import { InjectionService } from "../../context/injection-service";
import { ErrorHandlerService } from "../../context/error-handler-service";
import { Service } from "../../context/types";
import { EntityService, type Entity } from "../entity/entity-service";
import { EntityMigrationService } from "../migration/entity-migration-service";
import { Command, type CommandType } from "./command";
import { EntityCommand } from "./entity-command";

export interface ICommandService {
    cmd<T extends Command>(type: CommandType<T>): Omit<T, "execute">;
}

/** Owns the single pooled queue used by ordinary and entity commands. */
export class CommandService extends Service implements ICommandService {
    @Service.inject(InjectionService) private readonly _injection!: InjectionService;
    @Service.inject(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    @Service.inject(EntityService) private readonly _entities!: EntityService;
    @Service.inject(EntityMigrationService) private readonly _migration!: EntityMigrationService;

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

    /** @internal Internal Post hook. */
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

    /**
     * Releases objects retained above the requested high-water marks.
     * Call only at an explicit idle boundary such as a scene transition.
     */
    trimPools(retainPerType = 0, retainMigrationPlans = retainPerType): void {
        requireRetainCount("retainPerType", retainPerType);
        requireRetainCount("retainMigrationPlans", retainMigrationPlans);
        if (this._pendingUsed !== 0) throw new Error("Cannot trim CommandService while commands are pending");
        for (const pool of this._pools.values()) {
            if (pool.length > retainPerType) pool.length = retainPerType;
        }
        // Queue arrays contain stale references after flush even though their
        // logical used count is zero. An explicit trim is allowed to drop them.
        this._pending.length = 0;
        this._processing.length = 0;
        this._migration.trimPlans(retainMigrationPlans);
    }

    dispose(): void {
        let firstError: unknown;
        const used = this._pendingUsed;
        this._pendingUsed = 0;
        for (let i = 0; i < used; i++) {
            const command = this._pending[i];
            try {
                command._recycle();
            } catch (error) {
                try { this.onError(error, command); }
                catch (handlerError) { firstError ??= handlerError; }
            }
        }
        this._pending.length = 0;
        this._processing.length = 0;
        this._pools.clear();
        if (firstError !== undefined) throw firstError;
    }

    protected onError(error: unknown, _command?: Command): void {
        this._errors.report(error, "command", _command);
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

function requireRetainCount(name: string, value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
}
