import { DataSet, type Table } from "../storage/data-set";
import type { IAllocator } from "../storage/memory";
import { type TypedArray, Types } from "../storage/typed-array";
import { type ComponentId, type ComponentMeta } from "../component/component";
import { Mask } from "../component/mask";
import type { Entity, EntitySet } from "../entity/entity";

/** Archetype Table 中保存实体句柄的列索引。 */
export const ENTITY_COLUMN = 0;

declare const ARCHETYPE_ROW_BRAND: unique symbol;

/** Archetype 中无分配的 U32 Chunk 行位置。 */
export type ArchetypeRow = number & { readonly [ARCHETYPE_ROW_BRAND]: true };

/** 一个 Chunk 按 ComponentId 稀疏索引的组件字段列。 */
export type ChunkComponentViews = ReadonlyArray<readonly TypedArray[] | undefined>;

const MAX_ARCHETYPE_ROW = 0xFFFFFFFE;
const RETAIN_EMPTY_CHUNKS = 1;

/** 组件集合相同的实体密集存储；行和 Chunk 状态由 Archetype 自己拥有。 */
export class Archetype {
    readonly mask: Mask;
    readonly name: string;
    private readonly _types: ComponentMeta[];
    private readonly _dataSet: DataSet;
    private readonly _viewStorage: ChunkComponentViews[] = [];
    private readonly _entityStorage: EntitySet[] = [];
    private readonly _maxChunkIdx: number;
    private _count = 0;
    private _version = 0;
    private _disposed = false;

    /** 按 Chunk、ComponentId、字段编号直接索引的稳定列视图。 */
    readonly views: readonly ChunkComponentViews[] = this._viewStorage;
    /** 按 Chunk 直接索引的实体列。 */
    readonly entities: readonly EntitySet[] = this._entityStorage;

    /** 当前实体数量。 */
    get count(): number { return this._count; }
    /** 当前包含有效行的 Chunk 数量；可能小于 `views.length`。 */
    get chunkCount(): number { return Math.ceil(this._count / this.chunkCapacity); }
    /** 每个 Chunk 的固定行容量。 */
    get chunkCapacity(): number { return this._dataSet.layout.capacity; }
    /** 当前全部已分配 Chunk 占用的 Buffer 字节数。 */
    get allocatedBytes(): number {
        const first = this._dataSet.at(0);
        return first ? first.byteLength * this._dataSet.length : 0;
    }
    /** 按组件编号排序的组件元数据。 */
    get types(): ReadonlyArray<ComponentMeta> { return this._types; }
    /** @internal Chunk 集合创建或释放时递增。 */
    get version(): number { return this._version; }
    /** @internal 当前已分配（包含保留空 Chunk）的数量。 */
    get allocatedChunkCount(): number { return this._dataSet.length; }

    /** 创建指定组件掩码对应的 Archetype。 */
    constructor(
        mask: Mask,
        types: readonly ComponentMeta[] | undefined,
        allocator: IAllocator,
        private readonly _onLayoutChange?: () => void,
    ) {
        this.mask = mask.clone();
        this._types = types === undefined ? [] : [...types].sort((a, b) => a.id - b.id);
        const columnTypes: Types[] = [Types.Entity];
        const names: string[] = [];
        for (const component of this._types) {
            for (const fieldType of component.layout) columnTypes.push(fieldType);
            names.push(component.name);
        }
        this.name = names.join(" | ");
        this._dataSet = new DataSet(allocator, columnTypes);
        this._maxChunkIdx = Math.floor(
            (MAX_ARCHETYPE_ROW - (this.chunkCapacity - 1)) / this.chunkCapacity,
        );
    }

    /** 返回指定 Chunk 当前有效行数。 */
    chunkRowCount(chunkIdx: number): number {
        if (this._disposed || !Number.isInteger(chunkIdx) || chunkIdx < 0) return 0;
        const remaining = this._count - chunkIdx * this.chunkCapacity;
        if (remaining <= 0) return 0;
        return Math.min(remaining, this.chunkCapacity);
    }

    /** 插入实体并返回其行位置；所有组件字段初始为零。 */
    insert(entity: Entity): ArchetypeRow {
        this.assertUsable();
        const ordinal = this._count;
        const chunkIdx = Math.floor(ordinal / this.chunkCapacity);
        const row = ordinal - chunkIdx * this.chunkCapacity;
        this.ensureChunk(chunkIdx);
        const table = this._dataSet.at(chunkIdx)!;
        table.clearRow(row);
        this._entityStorage[chunkIdx][row] = entity;
        this._count++;
        return this.locationAt(chunkIdx, row);
    }

    /** 删除实体行；发生末行填补时返回被移动实体。 */
    remove(location: ArchetypeRow): Entity | undefined {
        this.assertUsable();
        if (!this.valid(location)) return undefined;
        const chunkIdx = this.chunkIdxOf(location);
        const row = this.rowIdxOf(location);
        const lastOrdinal = this._count - 1;
        const lastChunkIdx = Math.floor(lastOrdinal / this.chunkCapacity);
        const lastRow = lastOrdinal - lastChunkIdx * this.chunkCapacity;
        const same = chunkIdx === lastChunkIdx && row === lastRow;
        let moved: Entity | undefined;
        if (!same) {
            moved = this._entityStorage[lastChunkIdx][lastRow];
            this._dataSet.at(lastChunkIdx)!.copyRowTo(
                lastRow,
                this._dataSet.at(chunkIdx)!,
                row,
            );
        }
        this._count--;
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
        return this._entityStorage[this.chunkIdxOf(location)][this.rowIdxOf(location)];
    }

    /** 读取组件字段；位置、组件或字段无效时返回 `null`。 */
    getField(location: ArchetypeRow, compId: ComponentId, fieldId: number): number | null {
        if (!this.valid(location)) return null;
        const chunkIdx = this.chunkIdxOf(location);
        const column = this._viewStorage[chunkIdx]?.[compId]?.[fieldId];
        return column === undefined ? null : column[this.rowIdxOf(location)];
    }

    /** 写入组件字段；位置、组件或字段无效时返回 `false`。 */
    setField(location: ArchetypeRow, compId: ComponentId, fieldId: number, value: number): boolean {
        if (!this.valid(location)) return false;
        const chunkIdx = this.chunkIdxOf(location);
        const column = this._viewStorage[chunkIdx]?.[compId]?.[fieldId];
        if (column === undefined) return false;
        column[this.rowIdxOf(location)] = value;
        return true;
    }

    /** 使用 Chunk 下标和行索引直接写入组件字段。 */
    setFieldAt(chunkIdx: number, row: number, compId: ComponentId, fieldId: number, value: number): boolean {
        if (!this.validAt(chunkIdx, row)) return false;
        const column = this._viewStorage[chunkIdx]?.[compId]?.[fieldId];
        if (column === undefined) return false;
        column[row] = value;
        return true;
    }

    /** 返回实体所在 Chunk 的组件列视图；组件不存在时返回 `null`。 */
    getComp(location: ArchetypeRow, compId: ComponentId): TypedArray[] | null {
        if (!this.valid(location)) return null;
        const fields = this._viewStorage[this.chunkIdxOf(location)]?.[compId];
        return fields === undefined ? null : fields as TypedArray[];
    }

    /** 将源实体与目标 Archetype 共有的组件字段复制到目标行。 */
    copyCommonTo(source: ArchetypeRow, target: Archetype, targetRow: ArchetypeRow): void {
        if (!this.valid(source) || !target.valid(targetRow)) {
            throw new RangeError("Cannot copy invalid Archetype row");
        }
        const sourceViews = this._viewStorage[this.chunkIdxOf(source)];
        const targetViews = target._viewStorage[target.chunkIdxOf(targetRow)];
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
        const hadChunks = this._dataSet.length > 0;
        this._dataSet.dispose();
        this._viewStorage.length = 0;
        this._entityStorage.length = 0;
        this._count = 0;
        if (hadChunks) this.markLayoutChanged();
    }

    private ensureChunk(chunkIdx: number): void {
        if (chunkIdx < this._dataSet.length) return;
        if (chunkIdx !== this._dataSet.length) {
            throw new Error("Archetype Chunk sequence is not continuous");
        }
        if (chunkIdx > this._maxChunkIdx) {
            throw new RangeError(`Archetype Chunk capacity exceeded: ${this._maxChunkIdx + 1}`);
        }
        const table = this._dataSet.push();
        const previousViewCount = this._viewStorage.length;
        const previousEntityCount = this._entityStorage.length;
        try {
            const views = this.createViews(table);
            this._viewStorage.push(views);
            this._entityStorage.push(table.columns[ENTITY_COLUMN] as unknown as EntitySet);
            this.markLayoutChanged();
        } catch (error) {
            this._viewStorage.length = previousViewCount;
            this._entityStorage.length = previousEntityCount;
            this._dataSet.pop();
            throw error;
        }
    }

    private createViews(table: Table): ChunkComponentViews {
        const views: Array<readonly TypedArray[] | undefined> = [];
        let columnIdx = ENTITY_COLUMN + 1;
        for (const component of this._types) {
            const fields = new Array<TypedArray>(component.layout.length);
            for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
                fields[fieldIdx] = table.columns[columnIdx++];
            }
            views[component.id] = fields;
        }
        return views;
    }

    private releaseUnusedChunks(): void {
        const keep = this.chunkCount + RETAIN_EMPTY_CHUNKS;
        while (this._dataSet.length > keep) {
            this._viewStorage.pop();
            this._entityStorage.pop();
            this.markLayoutChanged();
            this._dataSet.pop();
        }
    }

    private markLayoutChanged(): void {
        this._version++;
        if (this._onLayoutChange) this._onLayoutChange();
    }

    private assertUsable(): void {
        if (this._disposed) throw new Error("Archetype has been disposed");
    }
}
