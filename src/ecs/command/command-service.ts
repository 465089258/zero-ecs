import { InjectionService } from "../../context/injection-service";
import { ErrorHandlerService } from "../../context/error-handler-service";
import { Service } from "../../context/types";
import { EntityService, type Entity } from "../entity/entity-service";
import { EntityMigrationService } from "../migration/entity-migration-service";
import { Command, type CommandType } from "./command";
import { EntityCommand } from "./entity-command";

/** 命令创建服务的最小接口。 */
export interface ICommandService {
    /** 获取指定类型的可提交命令；返回值可能来自对象池。 */
    cmd<T extends Command>(type: CommandType<T>): Omit<T, "execute">;
}

/** 统一管理普通命令与实体命令的创建、队列和对象池。 */
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

    /** 获取指定类型的命令，并注入当前 World 的依赖。调用方必须显式提交。 */
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

    /** 为已有实体创建局部事务；调用方必须显式提交。 */
    entity(entity: Entity): Omit<EntityCommand, "execute"> {
        const command = this.cmd(EntityCommand) as unknown as EntityCommand;
        command.bind(entity);
        return command;
    }

    /**
     * 立即预留实体句柄并返回未提交的实体命令。
     *
     * 当前版本不会自动取消未提交命令，调用方必须保留并最终提交该命令。
     */
    spawn(): Omit<EntityCommand, "execute"> {
        return this.entity(this._entities.spawn());
    }

    /** @internal 在内部 Post 阶段执行并回收全部已提交命令。 */
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
     * 释放超过指定保留数量的池化对象。
     *
     * 仅应在场景切换等明确的空闲边界调用；存在待执行命令时会抛出错误。
     */
    trimPools(retainPerType = 0, retainMigrationPlans = retainPerType): void {
        requireRetainCount("retainPerType", retainPerType);
        requireRetainCount("retainMigrationPlans", retainMigrationPlans);
        if (this._pendingUsed !== 0) throw new Error("Cannot trim CommandService while commands are pending");
        for (const pool of this._pools.values()) {
            if (pool.length > retainPerType) pool.length = retainPerType;
        }
        // 队列逻辑清空后仍保留旧引用；显式裁剪时允许释放这些引用。
        this._pending.length = 0;
        this._processing.length = 0;
        this._migration.trimPlans(retainMigrationPlans);
    }

    /** 回收待处理命令并释放所有命令池。 */
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

    /** 命令执行或回收失败时的统一错误入口。 */
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
