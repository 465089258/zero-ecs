import { InjectionService } from "../../context/injection-service";
import { ErrorHandlerService } from "../../context/error-handler-service";
import { EntityService, type Entity } from "../entity/entity-service";
import { EntityMigrationService } from "../migration/entity-migration-service";
import { Command, type CommandType } from "./command";
import { EntityCommand } from "./entity-command";
import { Service } from "../../context";
import { State } from "../../context";
import type { Mut } from "../../schedule/system";

/** 命令队列与对象池的 World-local 状态。 */
export class CommandState extends State {
    readonly pending: Command[] = [];
    readonly pendingUsed: number = 0;
    readonly processing: Command[] = [];
}

/** @internal 当前 World 的命令对象池；不属于可恢复模拟状态。 */
export class CommandPoolService extends Service {
    @Service.inject(InjectionService) private readonly _injection!: InjectionService;
    private readonly _pools = new Map<CommandType, Command[]>();

    acquire<T extends Command>(type: CommandType<T>, submit: (command: Command) => void): T {
        let pool = this._pools.get(type);
        if (!pool) {
            pool = [];
            this._pools.set(type, pool);
        }
        let command = pool.pop() as T | undefined;
        if (!command) {
            command = new type(submit);
            this._injection.inject(command);
        }
        command.reset(submit);
        return command;
    }

    recycle(command: Command): void {
        const type = command.constructor as CommandType;
        let pool = this._pools.get(type);
        if (!pool) {
            pool = [];
            this._pools.set(type, pool);
        }
        pool.push(command);
    }

    trim(retainPerType: number): void {
        for (const pool of this._pools.values()) {
            if (pool.length > retainPerType) pool.length = retainPerType;
        }
    }

    dispose(): void { this._pools.clear(); }
}

/** 命令创建服务的最小接口。 */
export interface ICommandService {
    /** 获取指定类型的可提交命令；返回值可能来自对象池。 */
    cmd<T extends Command>(type: CommandType<T>): Omit<T, "execute">;
}

/** 统一管理普通命令与实体命令的创建、队列和对象池。 */
export class CommandService extends Service implements ICommandService {
    @Service.inject(CommandPoolService) private readonly _pool!: CommandPoolService;
    @Service.inject(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    @Service.inject(EntityService) private readonly _entities!: EntityService;
    @Service.inject(EntityMigrationService) private readonly _migration!: EntityMigrationService;

    @State.inject(CommandState) private readonly _state!: Mut<CommandState>;
    private readonly _submit = (command: Command): void => { this.enqueue(command); };

    /** 获取指定类型的命令，并注入当前 World 的依赖。调用方必须显式提交。 */
    cmd<T extends Command>(type: CommandType<T>): Omit<T, "execute"> {
        return this._pool.acquire(type, this._submit);
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

    /**
     * 释放超过指定保留数量的池化对象。
     *
     * 仅应在场景切换等明确的空闲边界调用；存在待执行命令时会抛出错误。
     */
    trimPools(retainPerType = 0, retainMigrationPlans = retainPerType): void {
        requireRetainCount("retainPerType", retainPerType);
        requireRetainCount("retainMigrationPlans", retainMigrationPlans);
        const state = this._state;
        if (state.pendingUsed !== 0) throw new Error("Cannot trim CommandService while commands are pending");
        this._pool.trim(retainPerType);
        // 队列逻辑清空后仍保留旧引用；显式裁剪时允许释放这些引用。
        state.pending.length = 0;
        state.processing.length = 0;
        this._migration.trimPlans(retainMigrationPlans);
    }

    /** 回收待处理命令并释放所有命令池。 */
    dispose(): void {
        let firstError: unknown;
        const state = this._state;
        const used = state.pendingUsed;
        state.pendingUsed = 0;
        for (let i = 0; i < used; i++) {
            const command = state.pending[i];
            try {
                command._recycle();
            } catch (error) {
                try { this._errors.report(error, "command", command); }
                catch (handlerError) { firstError ??= handlerError; }
            }
        }
        state.pending.length = 0;
        state.processing.length = 0;
        if (firstError !== undefined) throw firstError;
    }

    private enqueue(command: Command): void {
        const state = this._state;
        const index = state.pendingUsed++;
        if (index < state.pending.length) state.pending[index] = command;
        else state.pending.push(command);
    }
}

function requireRetainCount(name: string, value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
}
