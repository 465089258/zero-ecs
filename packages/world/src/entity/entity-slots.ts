import { DataSet } from "../storage/data-set";
import type { IAllocator } from "../storage/memory";
import { Types } from "../storage/typed-array";
import type { Entity } from "./entity";
import {
    ENTITY_INDEX_MASK,
    ENTITY_VERSION_BITS,
    ENTITY_VERSION_MASK,
} from "./entity-format";

/** @internal 包内实体位置使用的无效 U32 值。 */
export const NONE_SLOT_VALUE = 0xFFFFFFFF;

const enum SlotColumn { Version, Archetype, Chunk, Row }

type U32 = typeof Types.U32;
type SlotColumns = readonly [U32, U32, U32, U32];

/** @internal World 内部拥有的实体槽位分页存储；不向公共 API 暴露 DataSet。 */
export class EntitySlots {
    private readonly _dataSet: DataSet<SlotColumns>;
    private readonly _freeIndices: number[] = [];
    private _count = 0;
    private _disposed = false;

    constructor(allocator: IAllocator) {
        this._dataSet = new DataSet(
            allocator,
            [Types.U32, Types.U32, Types.U32, Types.U32] as const,
        );
        this.appendSlot();
        this.write(0, SlotColumn.Version, 0);
        this.clearLocationAt(0);
    }

    /** 分配或复用一个带版本的实体句柄。 */
    reserve(): Entity {
        this.assertUsable();
        let index: number;
        if (this._freeIndices.length > 0) {
            index = this._freeIndices.pop()!;
        } else {
            if (this._count > ENTITY_INDEX_MASK) {
                throw new RangeError(`Entity capacity exceeded: ${ENTITY_INDEX_MASK}`);
            }
            index = this.appendSlot();
            this.write(index, SlotColumn.Version, 1);
        }
        let version = this.read(index, SlotColumn.Version) & ENTITY_VERSION_MASK;
        if (version === 0) {
            version = 1;
            this.write(index, SlotColumn.Version, version);
        }
        this.clearLocationAt(index);
        return (((index << ENTITY_VERSION_BITS) | version) >>> 0) as Entity;
    }

    /** 回收有效实体槽位；达到版本上限的槽位永久退休。 */
    release(entity: Entity): boolean {
        if (!this.valid(entity)) return false;
        const index = entity >>> ENTITY_VERSION_BITS;
        const version = entity & ENTITY_VERSION_MASK;
        this.clearLocationAt(index);
        if (version === ENTITY_VERSION_MASK) {
            this.write(index, SlotColumn.Version, 0);
            return true;
        }
        this.write(index, SlotColumn.Version, version + 1);
        this._freeIndices.push(index);
        return true;
    }

    /** 判断实体句柄索引和版本是否仍然有效。 */
    valid(entity: Entity): boolean {
        if (this._disposed) return false;
        const index = entity >>> ENTITY_VERSION_BITS;
        const version = entity & ENTITY_VERSION_MASK;
        return version !== 0 && index > 0 && index < this._count &&
            this.read(index, SlotColumn.Version) === version;
    }

    /** 读取槽位当前 Archetype 下标。 */
    archetypeIdxAt(index: number): number { return this.read(index, SlotColumn.Archetype); }
    /** 读取槽位当前 Archetype Chunk 下标。 */
    chunkIdxAt(index: number): number { return this.read(index, SlotColumn.Chunk); }
    /** 读取槽位当前 Chunk 行索引。 */
    rowAt(index: number): number { return this.read(index, SlotColumn.Row); }

    /** 写入实体当前 Archetype 与 Chunk 行位置。 */
    setLocationAt(index: number, archetypeIdx: number, chunkIdx: number, row: number): void {
        this.write(index, SlotColumn.Archetype, archetypeIdx);
        this.write(index, SlotColumn.Chunk, chunkIdx);
        this.write(index, SlotColumn.Row, row);
    }

    /** 清除实体的 Archetype 与 Chunk 行位置。 */
    clearLocationAt(index: number): void {
        this.write(index, SlotColumn.Archetype, NONE_SLOT_VALUE);
        this.write(index, SlotColumn.Chunk, NONE_SLOT_VALUE);
        this.write(index, SlotColumn.Row, NONE_SLOT_VALUE);
    }

    /** 释放全部 Slot Table；可重复调用。 */
    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        this._dataSet.dispose();
        this._freeIndices.length = 0;
        this._count = 0;
    }

    private appendSlot(): number {
        const index = this._count;
        const chunkIdx = Math.floor(index / this._dataSet.layout.capacity);
        if (chunkIdx === this._dataSet.length) this._dataSet.push();
        else if (chunkIdx > this._dataSet.length) {
            throw new Error("Entity Slot Chunk sequence is not continuous");
        }
        this._count++;
        return index;
    }

    private read(index: number, column: SlotColumn): number {
        const capacity = this._dataSet.layout.capacity;
        const chunkIdx = Math.floor(index / capacity);
        return this._dataSet.at(chunkIdx)!.get(index - chunkIdx * capacity, column);
    }

    private write(index: number, column: SlotColumn, value: number): void {
        const capacity = this._dataSet.layout.capacity;
        const chunkIdx = Math.floor(index / capacity);
        this._dataSet.at(chunkIdx)!.set(index - chunkIdx * capacity, column, value);
    }

    private assertUsable(): void {
        if (this._disposed) throw new Error("EntitySlots has been disposed");
    }
}
