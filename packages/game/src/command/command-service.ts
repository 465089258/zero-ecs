import { ErrorHandlerService } from "../context/error-handler-service";
import { InjectionService } from "../context/injection/service";
import { Inject, Service } from "../context";
import {
    type ComponentFieldValue,
    type ComponentFields,
    type ComponentType,
    type Entity,
    World,
} from "@zero-ecs/world";
import { type EntityMutator, EntityTransaction } from "../migration/entity-transaction";
import { Migrations } from "../migration/migration-service";
import { Command, type CommandType } from "./command";

/** 命令创建与延迟提交的稳定接口。 */
export interface ICommands {
    cmd<T extends Command>(type: CommandType<T>): Omit<T, "execute">;
    entity(entity: Entity): EntityCommand;
    spawn(): EntityCommand;
}

/** Commands 提交边界上的组合层扩展协议；不得由 World 内核依赖。 */
export interface CommandFlushExtension {
    /** 普通 Command 已执行、实体事务尚未合并时调用。 */
    flushCommands(commands: Commands): void;
}

/**
 * Game 侧命令队列、池和实体事务分组服务。
 *
 * 普通 Command 依赖 Game 的提交回调与 DI；EntityCommand 的事务语义由 Game Migrations
 * 实现，World 只执行即时底层修改。所有缓存均是 Service 私有运行时字段。
 */
export class Commands extends Service implements ICommands {
    @Service.inject(InjectionService) private readonly _injection!: InjectionService;
    @Service.inject(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    @Service.inject(Migrations) private readonly _migrations!: Migrations;
    @Inject.world() private readonly _world!: World;

    private readonly _commandPools = new Map<CommandType, Command[]>();

    private _pending: Command[] = [];
    private _pendingUsed = 0;
    private _processing: Command[] = [];

    private readonly _flushExtensions: CommandFlushExtension[] = [];

    private readonly _submitCommand = (command: Command): void => { this.enqueueCommand(command); };

    /** 获取指定类型的普通 Game Command；调用方必须显式调用其 `submit()`。 */
    cmd<T extends Command>(type: CommandType<T>): Omit<T, "execute"> {
        let pool = this._commandPools.get(type);
        if (!pool) {
            pool = [];
            this._commandPools.set(type, pool);
        }
        let command = pool.pop() as T | undefined;
        if (!command) {
            command = new type(this._submitCommand);
            this._injection.inject(command);
        }
        command.reset(this._submitCommand);
        return command;
    }

    /** 为已有实体取得可池化的 Game 局部事务。 */
    entity(entity: Entity): EntityCommand {
        const transaction = this._migrations.create(entity);
        const command = this.cmd(EntityCommand) as EntityCommand;
        command.bind(transaction);
        return command;
    }

    /** 立即预留实体句柄，并返回尚未提交的局部事务。 */
    spawn(): EntityCommand { return this.entity(this._world.spawn()); }

    /** @internal 接收 Game EntityCommand 解包后的迁移事务。 */
    enqueueEntityCommand(transaction: EntityTransaction): void {
        this._migrations.enqueue(transaction);
    }

    /** @internal 回收尚未进入迁移队列的事务。 */
    cancelEntityCommand(transaction: EntityTransaction): void {
        this._migrations.cancel(transaction);
    }

    /** @internal 注册一个提交扩展；通常由可选 Game Module 的 Service.activate 调用。 */
    addFlushExtension(extension: CommandFlushExtension): void {
        if (this._flushExtensions.indexOf(extension) !== -1) return;
        this._flushExtensions.push(extension);
    }

    /** @internal 移除此前注册的提交扩展。 */
    removeFlushExtension(extension: CommandFlushExtension): void {
        const index = this._flushExtensions.indexOf(extension);
        if (index !== -1) this._flushExtensions.splice(index, 1);
    }

    /** @internal 尚未合并的实体事务数量。 */
    get pendingEntityCommandCount(): number { return this._migrations.pendingCount; }

    /** @internal 读取尚未合并事务的目标实体。 */
    pendingEntityAt(index: number): Entity {
        return this._migrations.pendingEntityAt(index);
    }

    /** @internal 判断尚未合并的事务是否以 despawn 终止。 */
    pendingEntityWillDespawnAt(index: number): boolean {
        return this._migrations.pendingWillDespawnAt(index);
    }

    /** @internal 执行普通命令，并按实体把已提交局部事务合并为 accumulator。 */
    flush(): void {
        let firstError: unknown;
        let batches = 0;
        for (;;) {
            while (this._pendingUsed > 0 && batches++ < 1000) {
                const batch = this._pending;
                const used = this._pendingUsed;
                this._pending = this._processing;
                this._pendingUsed = 0;
                this._processing = batch;
                for (let i = 0; i < used; i++) {
                    const command = batch[i];
                    try { command._execute(); }
                    catch (error) { firstError ??= this.report(error, "command", command); }
                    finally {
                        try { command._recycle(); }
                        catch (error) { firstError ??= this.report(error, "command", command); }
                        finally { this.recycleCommand(command); }
                    }
                }
            }
            if (this._pendingUsed > 0) {
                firstError ??= this.report(new Error("Commands flush safety limit reached"), "command");
                break;
            }
            const extensions = this._flushExtensions;
            for (let i = 0; i < extensions.length; i++) {
                const extension = extensions[i];
                try { extension.flushCommands(this); }
                catch (error) { firstError ??= this.report(error, "command", extension); }
            }
            if (this._pendingUsed === 0) break;
        }
        const migrationError = this._migrations.collect();
        firstError ??= migrationError;
        if (firstError !== undefined) throw firstError;
    }

    /** 在宿主空闲边界裁剪普通命令池、实体命令池和空闲索引页。 */
    trimPools(retainPerType = 0, retainEntityCommands = retainPerType): void {
        requireRetainCount("retainPerType", retainPerType);
        requireRetainCount("retainEntityCommands", retainEntityCommands);
        if (this._pendingUsed !== 0) {
            throw new Error("Cannot trim Commands while commands are pending");
        }
        for (const pool of this._commandPools.values()) {
            if (pool.length > retainPerType) pool.length = retainPerType;
        }
        this._migrations.trim(retainEntityCommands);
        this._pending.length = 0;
        this._processing.length = 0;
    }

    /** 释放已提交队列和全部内部池。 */
    dispose(): void {
        let firstError: unknown;
        for (let i = 0; i < this._pendingUsed; i++) {
            const command = this._pending[i];
            try { command._recycle(); }
            catch (error) { firstError ??= this.report(error, "command", command); }
        }
        this._pendingUsed = 0;
        this._pending.length = 0;
        this._processing.length = 0;
        this._commandPools.clear();
        this._flushExtensions.length = 0;
        if (firstError !== undefined) throw firstError;
    }

    private enqueueCommand(command: Command): void {
        const index = this._pendingUsed++;
        if (index < this._pending.length) this._pending[index] = command;
        else this._pending.push(command);
    }

    private recycleCommand(command: Command): void {
        const type = command.constructor as CommandType;
        let pool = this._commandPools.get(type);
        if (!pool) {
            pool = [];
            this._commandPools.set(type, pool);
        }
        pool.push(command);
    }

    private report(error: unknown, source: string, target?: object): unknown {
        try {
            this._errors.report(error, source, target);
            return undefined;
        } catch (handlerError) {
            return handlerError;
        }
    }
}

/**
 * Game 侧可提交实体命令。
 * 内部组合 Game EntityTransaction，复用普通 Command 的提交队列与生命周期。
 */
export class EntityCommand extends Command implements EntityMutator {
    @Service.inject(Commands) private readonly _commands!: Commands;
    private _transaction: EntityTransaction | undefined;

    /** 当前目标实体；命令执行并回收后不可再读取。 */
    get entity(): Entity { return this.requireTransaction().entity; }

    /** @internal 绑定 Commands 为当前调用取得的 Game 迁移事务。 */
    bind(transaction: EntityTransaction): void {
        this.assertMutable();
        if (this._transaction) throw new Error("EntityCommand is already bound");
        this._transaction = transaction;
    }

    has<T extends object>(type: ComponentType<T>): boolean {
        this.assertMutable();
        return this.requireTransaction().has(type);
    }

    get<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
    ): ComponentFieldValue<T, Field> | null {
        this.assertMutable();
        return this.requireTransaction().get(type, field);
    }

    add<T extends object>(type: ComponentType<T>): this {
        this.assertMutable();
        this.requireTransaction().add(type);
        return this;
    }

    remove<T extends object>(type: ComponentType<T>): this {
        this.assertMutable();
        this.requireTransaction().remove(type);
        return this;
    }

    set<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
        value: ComponentFieldValue<T, Field>,
    ): this {
        this.assertMutable();
        this.requireTransaction().set(type, field, value);
        return this;
    }

    despawn(): this {
        this.assertMutable();
        this.requireTransaction().despawn();
        return this;
    }

    execute(): void {
        const transaction = this.requireTransaction();
        this._transaction = undefined;
        this._commands.enqueueEntityCommand(transaction);
    }

    protected clear(): void {
        const transaction = this._transaction;
        this._transaction = undefined;
        if (transaction) this._commands.cancelEntityCommand(transaction);
    }

    private requireTransaction(): EntityTransaction {
        if (!this._transaction) throw new Error("EntityCommand is not bound to a Game transaction");
        return this._transaction;
    }
}

function requireRetainCount(name: string, value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer`);
    }
}
