import { type Entity, World } from "@zero-ecs/world";
import { entityIndexOf } from "@zero-ecs/world/advanced";
import { ErrorHandlerService } from "../context/error-handler-service";
import { Inject, Service } from "../context";
import { EntityTransaction } from "./entity-transaction";

/**
 * Game 层实体迁移队列。
 *
 * 它拥有局部事务池、待合并队列、按 Entity 稀疏索引和最终 accumulator。
 * World 只负责立即执行 migrate/set/despawn，不感知事务、命令或提交阶段。
 */
export class Migrations extends Service {
    @Inject.service(ErrorHandlerService) private readonly _errors!: ErrorHandlerService;
    @Inject.world() private readonly _world!: World;

    private readonly _pool: EntityTransaction[] = [];
    private readonly _pending: EntityTransaction[] = [];
    private _pendingUsed = 0;
    private readonly _entityToAccumulator = new EntityPlanIndex();
    private readonly _accumulators: EntityTransaction[] = [];
    private _accumulatorUsed = 0;

    /** 创建或复用一个绑定实体的局部事务。 */
    create(entity: Entity): EntityTransaction {
        let transaction = this._pool.pop();
        if (!transaction) transaction = new EntityTransaction(this._world);
        transaction.reset(entity);
        return transaction;
    }

    /** 回收尚未提交的局部事务。 */
    cancel(transaction: EntityTransaction): void {
        this.requireOwned(transaction);
        transaction.cancel();
        this._pool.push(transaction);
    }

    /** 将局部事务封存并加入当前提交批次。 */
    enqueue(transaction: EntityTransaction): void {
        this.requireOwned(transaction);
        transaction.seal();
        const index = this._pendingUsed++;
        if (index < this._pending.length) this._pending[index] = transaction;
        else this._pending.push(transaction);
    }

    /** 当前尚未合并的实体事务数量。 */
    get pendingCount(): number { return this._pendingUsed; }

    /** 读取尚未合并事务的实体。 */
    pendingEntityAt(index: number): Entity {
        return this.requirePending(index).entity;
    }

    /** 判断尚未合并的事务是否以 despawn 终止。 */
    pendingWillDespawnAt(index: number): boolean {
        return this.requirePending(index).willDespawn();
    }

    /** 按 Entity 将当前批次的局部事务合并为一个最终事务。 */
    collect(): unknown {
        let firstError: unknown;
        const used = this._pendingUsed;
        this._pendingUsed = 0;
        for (let i = 0; i < used; i++) {
            const transaction = this._pending[i];
            const existing = this._entityToAccumulator.get(transaction.entity);
            if (existing === undefined) {
                const accumulator = this._accumulatorUsed++;
                if (accumulator < this._accumulators.length) {
                    this._accumulators[accumulator] = transaction;
                } else {
                    this._accumulators.push(transaction);
                }
                this._entityToAccumulator.set(transaction.entity, accumulator);
                continue;
            }
            try { this._accumulators[existing].merge(transaction); }
            catch (error) { firstError ??= this.report(error, transaction); }
            finally {
                const releaseError = this.release(transaction);
                firstError ??= releaseError;
            }
        }
        return firstError;
    }

    /** 应用每个 Entity 的最终迁移事务。 */
    apply(): void {
        let firstError: unknown;
        const used = this._accumulatorUsed;
        this._accumulatorUsed = 0;
        this._entityToAccumulator.clear();
        for (let i = 0; i < used; i++) {
            const transaction = this._accumulators[i];
            try {
                if (!transaction.apply()) {
                    firstError ??= this.report(
                        new RangeError(`Invalid entity ${transaction.entity}`),
                        transaction,
                    );
                }
            } catch (error) {
                firstError ??= this.report(error, transaction);
            } finally {
                try { transaction.release(); }
                catch (error) { firstError ??= this.report(error, transaction); }
                finally { this._pool.push(transaction); }
            }
        }
        if (firstError !== undefined) throw firstError;
    }

    /** 在无待处理事务时裁剪事务池和稀疏索引页。 */
    trim(retain = 0): void {
        requireRetainCount("retainEntityTransactions", retain);
        if (this._pendingUsed !== 0 || this._accumulatorUsed !== 0) {
            throw new Error("Cannot trim Migrations while transactions are pending");
        }
        if (this._pool.length > retain) this._pool.length = retain;
        this._pending.length = 0;
        this._accumulators.length = 0;
        this._entityToAccumulator.trim();
    }

    /** 释放已提交事务和内部缓存。 */
    dispose(): void {
        let firstError: unknown;
        for (let i = 0; i < this._pendingUsed; i++) {
            const transaction = this._pending[i];
            try { transaction.release(); }
            catch (error) { firstError ??= this.report(error, transaction); }
        }
        for (let i = 0; i < this._accumulatorUsed; i++) {
            const transaction = this._accumulators[i];
            try { transaction.release(); }
            catch (error) { firstError ??= this.report(error, transaction); }
        }
        this._pendingUsed = 0;
        this._accumulatorUsed = 0;
        this._pending.length = 0;
        this._accumulators.length = 0;
        this._pool.length = 0;
        this._entityToAccumulator.trim();
        if (firstError !== undefined) throw firstError;
    }

    private requireOwned(transaction: EntityTransaction): void {
        if (!transaction.belongsTo(this._world)) {
            throw new Error("EntityTransaction belongs to another World");
        }
    }

    private requirePending(index: number): EntityTransaction {
        if (!Number.isInteger(index) || index < 0 || index >= this._pendingUsed) {
            throw new RangeError(`Pending EntityCommand index ${index} is outside the active range`);
        }
        return this._pending[index];
    }

    private release(transaction: EntityTransaction): unknown {
        let error: unknown;
        try { transaction.release(); }
        catch (releaseError) {
            error = this.report(releaseError, transaction);
        } finally {
            this._pool.push(transaction);
        }
        return error;
    }

    private report(error: unknown, target: object): unknown {
        try {
            this._errors.report(error, "entity-command", target);
            return undefined;
        } catch (handlerError) {
            return handlerError;
        }
    }
}

const ENTITY_PAGE_SHIFT = 10;
const ENTITY_PAGE_SIZE = 1 << ENTITY_PAGE_SHIFT;
const ENTITY_PAGE_MASK = ENTITY_PAGE_SIZE - 1;

interface EntityPlanPage {
    readonly entities: Uint32Array;
    readonly plans: Uint32Array;
}

/** 一个提交批次内使用的稀疏分页 Entity → accumulator 索引。 */
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
