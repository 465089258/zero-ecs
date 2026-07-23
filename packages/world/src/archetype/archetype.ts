import type { IAllocator } from "../storage/memory";
import { type TypedArray, Types } from "../storage/typed-array";
import { type ComponentId, type ComponentMeta } from "../component/component";
import { Mask } from "../component/mask";
import type { Entity } from "../entity/entity";
import { ENTITY_INDEX_MASK } from "../entity/entity-format";
import {
    ArchetypeChunk,
    ArchetypeChunks,
} from "./archetype-chunk";

export { ENTITY_COLUMN } from "./archetype-chunk";
export type { ComponentViews } from "./archetype-chunk";

declare const ARCHETYPE_ROW_BRAND: unique symbol;

/** Archetype 中无分配的 U32 Chunk 行位置。 */
export type ArchetypeRow = number & { readonly [ARCHETYPE_ROW_BRAND]: true };

/** 单个 Archetype 不可能包含超过 World 实体索引容量的行。 */
const MAX_ARCHETYPE_ROW = ENTITY_INDEX_MASK - 1;
/** 组件集合相同的实体密集存储；行和 Chunk 状态由 Archetype 自己拥有。 */
export class Archetype {
    readonly mask: Mask;
    readonly name: string;
    readonly types: readonly ComponentMeta[];
    private readonly _chunks: ArchetypeChunks;
    private readonly maxChunkIdx: number;
    /** 每个 Chunk 的固定行容量。 */
    readonly chunkCapacity: number;
    /** 当前实体数量。 */
    count = 0;
    version = 0;
    private _spareChunkLimit = 0;
    private _disposed = false;

    /** 当前包含有效行的逻辑 Chunk 数量；可能小于已分配 Chunk 数量。 */
    get chunks(): number { return Math.ceil(this.count / this.chunkCapacity); }
    /** 当前全部已分配 Chunk 占用的 Buffer 字节数。 */
    get allocatedBytes(): number { return this._chunks.allocatedBytes; }

    /** @internal 当前已分配（包含保留空 Chunk）的数量。 */
    get allocatedChunkCount(): number { return this._chunks.length; }
    /** 最多保留的连续空闲尾 Chunk 数量。 */
    get spareChunkLimit(): number { return this._spareChunkLimit; }

    /** 创建指定组件掩码对应的 Archetype。 */
    constructor(
        mask: Mask,
        types: readonly ComponentMeta[] | undefined,
        allocator: IAllocator,
    ) {
        this.mask = mask.clone();
        this.types = types === undefined ? [] : [...types].sort((a, b) => a.id - b.id);
        const columns: [typeof Types.Entity, ...Types[]] = [Types.Entity];
        const names: string[] = [];
        for (let i = 0; i < this.types.length; i++) {
            const comp = this.types[i];
            for (const fieldType of comp.layout) columns.push(fieldType);
            names.push(comp.name);
        }
        this.name = names.join(";");
        this._chunks = new ArchetypeChunks(
            allocator,
            columns,
            this.types,
        );
        this.chunkCapacity = this._chunks.layout.capacity;
        this.maxChunkIdx = Math.floor(MAX_ARCHETYPE_ROW / this.chunkCapacity);
    }

    /** 设置最多保留的连续空闲尾 Chunk 数量；增大限制不会主动分配 Chunk。 */
    setSpareChunkLimit(value: number): void {
        this.assertUsable();
        if (!Number.isSafeInteger(value) || value < 0) {
            throw new RangeError("spareChunkLimit must be a non-negative safe integer");
        }
        if (value === this._spareChunkLimit) return;
        this._spareChunkLimit = value;
        this.releaseUnusedChunks();
    }

    /** 返回指定 Chunk 当前有效行数。 */
    chunkRowCount(chunkIdx: number): number {
        if (this._disposed || !Number.isInteger(chunkIdx) || chunkIdx < 0) return 0;
        const remaining = this.count - chunkIdx * this.chunkCapacity;
        if (remaining <= 0) return 0;
        return Math.min(remaining, this.chunkCapacity);
    }

    /** 插入实体并返回其行位置；除 Entity 列外不初始化复用行中的组件数据。 */
    insert(entity: Entity): ArchetypeRow {
        this.assertUsable();
        const chunkCapacity = this.chunkCapacity;
        const ordinal = this.count;
        const chunkIdx = Math.floor(ordinal / chunkCapacity);
        const row = ordinal - chunkIdx * chunkCapacity;
        this.ensureChunk(chunkIdx);
        this._chunks.tables[chunkIdx].entities[row] = entity;
        this.count++;
        return this.locationAt(chunkIdx, row);
    }

    /** 删除实体行；发生末行填补时返回被移动实体。 */
    remove(location: ArchetypeRow): Entity | undefined {
        this.assertUsable();
        if (!this.valid(location)) return undefined;
        const chunkIdx = this.chunkIdxOf(location);
        const row = this.rowIdxOf(location);
        const lastOrdinal = this.count - 1;
        const lastChunkIdx = Math.floor(lastOrdinal / this.chunkCapacity);
        const lastRow = lastOrdinal - lastChunkIdx * this.chunkCapacity;
        const same = chunkIdx === lastChunkIdx && row === lastRow;
        let moved: Entity | undefined;
        if (!same) {
            const lastChunk = this._chunks.tables[lastChunkIdx];
            moved = lastChunk.entities[lastRow]!;
            lastChunk.copyRowTo(
                lastRow,
                this._chunks.tables[chunkIdx],
                row,
            );
        }
        this.count--;
        this.releaseUnusedChunks();
        return moved;
    }

    /** 判断 ArchetypeRow 当前是否指向有效逻辑行。 */
    valid(location: ArchetypeRow): boolean {
        if (this._disposed || !Number.isInteger(location) || location < 0 || location > MAX_ARCHETYPE_ROW) {
            return false;
        }
        return this.validAt(this.chunkIdxOf(location), this.rowIdxOf(location));
    }

    /** 判断指定 Chunk 行是否有效。 */
    validAt(chunkIdx: number, row: number): boolean {
        return !this._disposed && Number.isInteger(row) && row >= 0 &&
            row < this.chunkRowCount(chunkIdx);
    }

    /** 将 Chunk 下标和行索引编码为无分配的 ArchetypeRow。 */
    locationAt(chunkIdx: number, row: number): ArchetypeRow {
        return (chunkIdx * this.chunkCapacity + row) as ArchetypeRow;
    }

    /** 从 ArchetypeRow 解码 Chunk 下标。 */
    chunkIdxOf(location: ArchetypeRow): number {
        return Math.floor(location / this.chunkCapacity);
    }

    /** 从 ArchetypeRow 解码 Chunk 内行索引。 */
    rowIdxOf(location: ArchetypeRow): number {
        const chunkIdx = Math.floor(location / this.chunkCapacity);
        return location - chunkIdx * this.chunkCapacity;
    }

    /** 获取指定位置的实体句柄；位置无效时返回 `undefined`。 */
    getEntity(location: ArchetypeRow): Entity | undefined {
        if (!this.valid(location)) return undefined;
        return this._chunks.tables[this.chunkIdxOf(location)].entities[this.rowIdxOf(location)];
    }

    /**
     * 按连续下标返回已分配 Chunk。
     *
     * 返回值是可能随结构变更失效的底层数据视图；调用者不得跨结构变更长期缓存。
     */
    chunkAt(chunkIdx: number): ArchetypeChunk | undefined {
        return this._chunks.tables[chunkIdx];
    }

    /** 读取组件字段；位置、组件或字段无效时返回 `null`。 */
    getField(location: ArchetypeRow, compId: ComponentId, fieldId: number): number | null {
        if (!this.valid(location)) return null;
        const chunkIdx = this.chunkIdxOf(location);
        const column = this._chunks.tables[chunkIdx]?.views[compId]?.[fieldId];
        return column === undefined ? null : column[this.rowIdxOf(location)];
    }

    /** 写入组件字段；位置、组件或字段无效时返回 `false`。 */
    setField(location: ArchetypeRow, compId: ComponentId, fieldId: number, value: number): boolean {
        if (!this.valid(location)) return false;
        const chunkIdx = this.chunkIdxOf(location);
        const column = this._chunks.tables[chunkIdx]?.views[compId]?.[fieldId];
        if (column === undefined) return false;
        column[this.rowIdxOf(location)] = value;
        return true;
    }

    /** 使用 Chunk 下标和行索引直接写入组件字段。 */
    setFieldAt(chunkIdx: number, row: number, compId: ComponentId, fieldId: number, value: number): boolean {
        if (!this.validAt(chunkIdx, row)) return false;
        const column = this._chunks.tables[chunkIdx]?.views[compId]?.[fieldId];
        if (column === undefined) return false;
        column[row] = value;
        return true;
    }

    /** 返回实体所在 Chunk 的组件列视图；组件不存在时返回 `null`。 */
    getComp(location: ArchetypeRow, compId: ComponentId): TypedArray[] | null {
        if (!this.valid(location)) return null;
        const fields = this._chunks.tables[this.chunkIdxOf(location)].views[compId];
        return fields === undefined ? null : fields as TypedArray[];
    }

    /** 将源实体与目标 Archetype 共有的组件字段复制到目标行。 */
    copyRowTo(source: ArchetypeRow, target: Archetype, targetRow: ArchetypeRow): void {
        if (!this.valid(source) || !target.valid(targetRow)) {
            throw new RangeError("Cannot copy invalid Archetype row");
        }
        const sourceViews = this._chunks.tables[this.chunkIdxOf(source)].views;
        const targetViews = target._chunks.tables[target.chunkIdxOf(targetRow)].views;
        const sourceRow = this.rowIdxOf(source);
        const targetRowIdx = target.rowIdxOf(targetRow);
        const types = target.types;
        for (let typeIdx = 0; typeIdx < types.length; typeIdx++) {
            const component = types[typeIdx];
            const sourceFields = sourceViews[component.id];
            const targetFields = targetViews[component.id];
            if (!sourceFields || !targetFields) continue;
            for (let field = 0; field < sourceFields.length; field++) {
                targetFields[field][targetRowIdx] = sourceFields[field][sourceRow];
            }
        }
    }

    /** 释放该 Archetype 持有的全部 Chunk。 */
    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        this.count = 0;
        let failed = false;
        let firstError: unknown;
        try {
            this.releaseChunksUntil(0);
        } catch (error) {
            failed = true;
            firstError = error;
        }
        const beforeDispose = this._chunks.length;
        try {
            this._chunks.dispose();
        } catch (error) {
            if (!failed) {
                failed = true;
                firstError = error;
            }
        } finally {
            if (this._chunks.length < beforeDispose) this.version++;
        }
        if (failed) throw firstError;
    }

    private ensureChunk(chunkIdx: number): void {
        if (chunkIdx < this._chunks.length) return;
        if (chunkIdx !== this._chunks.length) {
            throw new Error("Archetype Chunk sequence is not continuous");
        }
        if (chunkIdx > this.maxChunkIdx) {
            throw new RangeError(`Archetype Chunk capacity exceeded: ${this.maxChunkIdx + 1}`);
        }
        this._chunks.push();
        this.version++;
    }

    private releaseUnusedChunks(): void {
        const keep = Math.min(
            this._chunks.length,
            this.chunks + this._spareChunkLimit,
        );
        this.releaseChunksUntil(keep);
    }

    private releaseChunksUntil(keep: number): void {
        let failed = false;
        let firstError: unknown;
        while (this._chunks.length > keep) {
            const before = this._chunks.length;
            try {
                this._chunks.pop();
            } catch (error) {
                if (!failed) {
                    failed = true;
                    firstError = error;
                }
            }
            if (this._chunks.length < before) {
                this.version++;
                continue;
            }
            if (!failed) {
                failed = true;
                firstError = new Error("Archetype Chunk release made no progress");
            }
            break;
        }
        if (failed) throw firstError;
    }

    private assertUsable(): void {
        if (this._disposed) throw new Error("Archetype has been disposed");
    }
}
