import { ErrorHandlerService } from "../context/error-handler-service";
import { InjectionService } from "../context/injection/service";
import { Inject, Service } from "../context";
import {
    type ComponentFieldValue,
    type ComponentFields,
    type ComponentType,
    type Entity,
    type EntityCommand as RawEntityCommand,
    type EntityMutator,
    World,
} from "@zero-ecs/world";
import {
    entityIndexOf,
    type InternalEntityCommand as InternalRawEntityCommand,
    ownsEntityCommand,
} from "@zero-ecs/world/game-bridge";
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
 * 普通 Command 依赖 Game 的提交回调与 DI；EntityCommand 的组件语义和最终应用始终由
 * World 实现。所有缓存均是 Service 私有运行时字段，不属于可序列化 State。
 */
export class Commands extends Service implements ICommands {
    @Service.inject(InjectionService) private readonly _injection!: InjectionService;
    @Service.inject(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    @Inject.world() private readonly _world!: World;

    private readonly _commandPools = new Map<CommandType, Command[]>();
    private readonly _entityPool: InternalRawEntityCommand[] = [];

    private _pending: Command[] = [];
    private _pendingUsed = 0;
    private _processing: Command[] = [];

    private readonly _entityPending: InternalRawEntityCommand[] = [];
    private _entityPendingUsed = 0;
    private readonly _entityToAccumulator = new EntityPlanIndex();
    private readonly _accumulators: InternalRawEntityCommand[] = [];
    private _accumulatorUsed = 0;
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

    /** 为已有实体取得可池化的 World-local 局部事务。 */
    entity(entity: Entity): EntityCommand {
        let raw = this._entityPool.pop();
        if (raw) raw.reset(entity);
        else raw = this._world.createEntityCommand(entity) as InternalRawEntityCommand;
        const command = this.cmd(EntityCommand) as EntityCommand;
        command.bind(raw);
        return command;
    }

    /** 立即预留实体句柄，并返回尚未提交的局部事务。 */
    spawn(): EntityCommand { return this.entity(this._world.spawn()); }

    /** @internal 接收 Game EntityCommand 解包后的 World 原始事务。 */
    enqueueEntityCommand(command: RawEntityCommand): void {
        if (!ownsEntityCommand(this._world, command)) {
            throw new Error("EntityCommand belongs to another World");
        }
        const internal = command as InternalRawEntityCommand;
        internal._seal();
        const index = this._entityPendingUsed++;
        if (index < this._entityPending.length) this._entityPending[index] = internal;
        else this._entityPending.push(internal);
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

    /** @internal 尚未合并的 World 原始实体事务数量。 */
    get pendingEntityCommandCount(): number { return this._entityPendingUsed; }

    /** @internal 读取尚未合并事务的目标实体。 */
    pendingEntityAt(index: number): Entity {
        return this.requirePendingEntityCommand(index).entity;
    }

    /** @internal 判断尚未合并的事务是否以 despawn 终止。 */
    pendingEntityWillDespawnAt(index: number): boolean {
        return this.requirePendingEntityCommand(index)._willDespawn();
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
        firstError ??= this.collectEntityCommands();
        if (firstError !== undefined) throw firstError;
    }

    /** @internal 在 Structure System 中应用每实体的最终事务。 */
    applyEntityCommands(): void {
        let firstError: unknown;
        const used = this._accumulatorUsed;
        this._accumulatorUsed = 0;
        this._entityToAccumulator.clear();
        for (let i = 0; i < used; i++) {
            const command = this._accumulators[i];
            try {
                if (!this._world.applyEntityCommand(command)) {
                    firstError ??= this.report(
                        new RangeError(`Invalid entity ${command.entity}`),
                        "entity-command",
                        command,
                    );
                }
            } catch (error) {
                firstError ??= this.report(error, "entity-command", command);
            } finally {
                try { command._release(); }
                catch (error) { firstError ??= this.report(error, "entity-command", command); }
                finally { this._entityPool.push(command); }
            }
        }
        if (firstError !== undefined) throw firstError;
    }

    /** 在宿主空闲边界裁剪普通命令池、实体命令池和空闲索引页。 */
    trimPools(retainPerType = 0, retainEntityCommands = retainPerType): void {
        requireRetainCount("retainPerType", retainPerType);
        requireRetainCount("retainEntityCommands", retainEntityCommands);
        if (this._pendingUsed !== 0 || this._entityPendingUsed !== 0 || this._accumulatorUsed !== 0) {
            throw new Error("Cannot trim Commands while commands are pending");
        }
        for (const pool of this._commandPools.values()) {
            if (pool.length > retainPerType) pool.length = retainPerType;
        }
        if (this._entityPool.length > retainEntityCommands) {
            this._entityPool.length = retainEntityCommands;
        }
        this._pending.length = 0;
        this._processing.length = 0;
        this._entityPending.length = 0;
        this._accumulators.length = 0;
        this._entityToAccumulator.trim();
    }

    /** 释放已提交队列和全部内部池。 */
    dispose(): void {
        let firstError: unknown;
        for (let i = 0; i < this._pendingUsed; i++) {
            const command = this._pending[i];
            try { command._recycle(); }
            catch (error) { firstError ??= this.report(error, "command", command); }
        }
        for (let i = 0; i < this._entityPendingUsed; i++) {
            const command = this._entityPending[i];
            try { command._release(); }
            catch (error) { firstError ??= this.report(error, "entity-command", command); }
        }
        for (let i = 0; i < this._accumulatorUsed; i++) {
            const command = this._accumulators[i];
            try { command._release(); }
            catch (error) { firstError ??= this.report(error, "entity-command", command); }
        }
        this._pendingUsed = 0;
        this._entityPendingUsed = 0;
        this._accumulatorUsed = 0;
        this._pending.length = 0;
        this._processing.length = 0;
        this._entityPending.length = 0;
        this._accumulators.length = 0;
        this._entityToAccumulator.trim();
        this._commandPools.clear();
        this._entityPool.length = 0;
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

    private requirePendingEntityCommand(index: number): InternalRawEntityCommand {
        if (!Number.isInteger(index) || index < 0 || index >= this._entityPendingUsed) {
            throw new RangeError(`Pending EntityCommand index ${index} is outside the active range`);
        }
        return this._entityPending[index];
    }

    private collectEntityCommands(): unknown {
        let firstError: unknown;
        const used = this._entityPendingUsed;
        this._entityPendingUsed = 0;
        for (let i = 0; i < used; i++) {
            const command = this._entityPending[i];
            const existing = this._entityToAccumulator.get(command.entity);
            if (existing === undefined) {
                const accumulator = this._accumulatorUsed++;
                if (accumulator < this._accumulators.length) this._accumulators[accumulator] = command;
                else this._accumulators.push(command);
                this._entityToAccumulator.set(command.entity, accumulator);
                continue;
            }
            try { this._accumulators[existing]._merge(command); }
            catch (error) { firstError ??= this.report(error, "entity-command", command); }
            finally {
                try { command._release(); }
                catch (error) { firstError ??= this.report(error, "entity-command", command); }
                finally { this._entityPool.push(command); }
            }
        }
        return firstError;
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
 * 内部组合 World 的 RawEntityCommand，复用普通 Command 的提交队列、生命周期和对象池。
 */
export class EntityCommand extends Command implements EntityMutator {
    @Service.inject(Commands) private readonly _commands!: Commands;
    private _raw: InternalRawEntityCommand | undefined;

    /** 当前目标实体；命令执行并回收后不可再读取。 */
    get entity(): Entity { return this.requireRaw().entity; }

    /** @internal 绑定 Commands 为当前调用取得的 World 原始事务。 */
    bind(raw: InternalRawEntityCommand): void {
        this.assertMutable();
        if (this._raw) throw new Error("EntityCommand is already bound");
        this._raw = raw;
    }

    has<T extends object>(type: ComponentType<T>): boolean {
        this.assertMutable();
        return this.requireRaw().has(type);
    }

    get<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
    ): ComponentFieldValue<T, Field> | null {
        this.assertMutable();
        return this.requireRaw().get(type, field);
    }

    add<T extends object>(type: ComponentType<T>): this {
        this.assertMutable();
        this.requireRaw().add(type);
        return this;
    }

    remove<T extends object>(type: ComponentType<T>): this {
        this.assertMutable();
        this.requireRaw().remove(type);
        return this;
    }

    set<T extends object, Field extends ComponentFields<T>>(
        type: ComponentType<T>,
        field: Field,
        value: ComponentFieldValue<T, Field>,
    ): this {
        this.assertMutable();
        this.requireRaw().set(type, field, value);
        return this;
    }

    despawn(): this {
        this.assertMutable();
        this.requireRaw().despawn();
        return this;
    }

    execute(): void {
        const raw = this.requireRaw();
        this._raw = undefined;
        this._commands.enqueueEntityCommand(raw);
    }

    protected clear(): void { this._raw = undefined; }

    private requireRaw(): InternalRawEntityCommand {
        if (!this._raw) throw new Error("EntityCommand is not bound to a World transaction");
        return this._raw;
    }
}


const ENTITY_PAGE_SHIFT = 10;
const ENTITY_PAGE_SIZE = 1 << ENTITY_PAGE_SHIFT;
const ENTITY_PAGE_MASK = ENTITY_PAGE_SIZE - 1;

interface EntityPlanPage {
    readonly entities: Uint32Array;
    readonly plans: Uint32Array;
}

/** 一个提交批次内使用的稀疏分页索引。 */
class EntityPlanIndex {
    private readonly _pages: Array<EntityPlanPage | undefined> = [];
    private readonly _touched: number[] = [];
    private _touchedUsed = 0;

    get(entity: Entity): number | undefined {
        const rawIndex = entityIndexOf(entity);
        const page = this._pages[rawIndex >>> ENTITY_PAGE_SHIFT];
        const offset = rawIndex & ENTITY_PAGE_MASK;
        return page && page.entities[offset] === entity ? page.plans[offset] - 1 : undefined;
    }

    set(entity: Entity, plan: number): void {
        const rawIndex = entityIndexOf(entity);
        const pageIndex = rawIndex >>> ENTITY_PAGE_SHIFT;
        let page = this._pages[pageIndex];
        if (!page) {
            page = {
                entities: new Uint32Array(ENTITY_PAGE_SIZE),
                plans: new Uint32Array(ENTITY_PAGE_SIZE),
            };
            this._pages[pageIndex] = page;
        }
        const offset = rawIndex & ENTITY_PAGE_MASK;
        if (page.entities[offset] === 0) writeHighWater(this._touched, this._touchedUsed++, rawIndex);
        page.entities[offset] = entity;
        page.plans[offset] = plan + 1;
    }

    clear(): void {
        for (let i = 0; i < this._touchedUsed; i++) {
            const rawIndex = this._touched[i];
            const page = this._pages[rawIndex >>> ENTITY_PAGE_SHIFT]!;
            const offset = rawIndex & ENTITY_PAGE_MASK;
            page.entities[offset] = 0;
            page.plans[offset] = 0;
        }
        this._touchedUsed = 0;
    }

    trim(): void {
        this._pages.length = 0;
        this._touched.length = 0;
        this._touchedUsed = 0;
    }
}

function writeHighWater(values: number[], index: number, value: number): void {
    if (index < values.length) values[index] = value;
    else values.push(value);
}

function requireRetainCount(name: string, value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer`);
    }
}
