import { DataSet, type Table } from "../storage/data-set";
import type { IAllocator } from "../storage/memory";
import { E32, type TypedArray, Types } from "../storage/typed-array";
import { type ComponentId, type ComponentMeta } from "../component/component";
import { Mask } from "../component/mask";
import type { Entity, EntitySet } from "../entity/entity";
import { ENTITY_INDEX_MASK } from "../entity/entity-format";

/** Archetype Table 中保存实体句柄的列索引。 */
export const ENTITY_COLUMN = 0;

declare const ARCHETYPE_ROW_BRAND: unique symbol;

/** Archetype 中无分配的 U32 Chunk 行位置。 */
export type ArchetypeRow = number & { readonly [ARCHETYPE_ROW_BRAND]: true };

/** 一个 Chunk 按 ComponentId 稀疏索引的组件字段列。 */
export type ComponentViews = ReadonlyArray<readonly TypedArray[] | undefined>;

/** 单个 Archetype 不可能包含超过 World 实体索引容量的行。 */
const MAX_ARCHETYPE_ROW = ENTITY_INDEX_MASK - 1;
const RETAIN_EMPTY_CHUNKS = 1;
type SlotColumns<T extends Types[] = Types[]> = [E32, ...T];
/** 组件集合相同的实体密集存储；行和 Chunk 状态由 Archetype 自己拥有。 */
export class Archetype {
    readonly mask: Mask;
    readonly name: string;
    readonly types: ComponentMeta[];
    readonly data: DataSet<SlotColumns>;
    readonly views: ComponentViews[] = [];
    readonly entities: EntitySet[] = [];
    private readonly maxChunkIdx: number;
    /** 每个 Chunk 的固定行容量。 */
    readonly chunkCapacity: number;
    /** 当前实体数量。 */
    count = 0;
    version = 0;
    private _disposed = false;

    /** 当前包含有效行的 Chunk 数量；可能小于 `views.length`。 */
    get chunks(): number { return Math.ceil(this.count / this.chunkCapacity); }
    /** 当前全部已分配 Chunk 占用的 Buffer 字节数。 */
    get allocatedBytes(): number {
        const first = this.data.tables[0];
        return first ? first.byteLength * this.data.length : 0;
    }

    /** 按组件编号排序的组件元数据。 */

    /** @internal 当前已分配（包含保留空 Chunk）的数量。 */
    get allocatedChunkCount(): number { return this.data.length; }

    /** 创建指定组件掩码对应的 Archetype。 */
    constructor(
        mask: Mask,
        types: readonly ComponentMeta[] | undefined,
        allocator: IAllocator,
        private readonly onLayoutChange?: () => void,
    ) {
        this.mask = mask.clone();
        this.types = types === undefined ? [] : [...types].sort((a, b) => a.id - b.id);
        const layout: SlotColumns = [Types.Entity];
        const names: string[] = [];
        for (let i = 0; i < this.types.length; i++) {
            const comp = this.types[i];
            for (const fieldType of comp.layout) layout.push(fieldType);
            names.push(comp.name);
        }
        this.name = names.join(";");
        this.data = new DataSet(allocator, layout);
        this.chunkCapacity = this.data.layout.capacity;
        this.maxChunkIdx = Math.floor(MAX_ARCHETYPE_ROW / this.chunkCapacity);
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
        this.data.tables[chunkIdx].columns[0][row] = entity;
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
            const lastTable = this.data.tables[lastChunkIdx];
            moved = lastTable.columns[0][lastRow]!;
            lastTable.copyRowTo(
                lastRow,
                this.data.tables[chunkIdx],
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
        return this.entities[this.chunkIdxOf(location)][this.rowIdxOf(location)];
    }

    /** 读取组件字段；位置、组件或字段无效时返回 `null`。 */
    getField(location: ArchetypeRow, compId: ComponentId, fieldId: number): number | null {
        if (!this.valid(location)) return null;
        const chunkIdx = this.chunkIdxOf(location);
        const column = this.views[chunkIdx]?.[compId]?.[fieldId];
        return column === undefined ? null : column[this.rowIdxOf(location)];
    }

    /** 写入组件字段；位置、组件或字段无效时返回 `false`。 */
    setField(location: ArchetypeRow, compId: ComponentId, fieldId: number, value: number): boolean {
        if (!this.valid(location)) return false;
        const chunkIdx = this.chunkIdxOf(location);
        const column = this.views[chunkIdx]?.[compId]?.[fieldId];
        if (column === undefined) return false;
        column[this.rowIdxOf(location)] = value;
        return true;
    }

    /** 使用 Chunk 下标和行索引直接写入组件字段。 */
    setFieldAt(chunkIdx: number, row: number, compId: ComponentId, fieldId: number, value: number): boolean {
        if (!this.validAt(chunkIdx, row)) return false;
        const column = this.views[chunkIdx]?.[compId]?.[fieldId];
        if (column === undefined) return false;
        column[row] = value;
        return true;
    }

    /** 返回实体所在 Chunk 的组件列视图；组件不存在时返回 `null`。 */
    getComp(location: ArchetypeRow, compId: ComponentId): TypedArray[] | null {
        if (!this.valid(location)) return null;
        const fields = this.views[this.chunkIdxOf(location)]?.[compId];
        return fields === undefined ? null : fields as TypedArray[];
    }

    /** 将源实体与目标 Archetype 共有的组件字段复制到目标行。 */
    copyRowTo(source: ArchetypeRow, target: Archetype, targetRow: ArchetypeRow): void {
        if (!this.valid(source) || !target.valid(targetRow)) {
            throw new RangeError("Cannot copy invalid Archetype row");
        }
        const sourceViews = this.views[this.chunkIdxOf(source)];
        const targetViews = target.views[target.chunkIdxOf(targetRow)];
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
        const hadChunks = this.data.length > 0;
        this.data.dispose();
        this.views.length = 0;
        this.entities.length = 0;
        this.count = 0;
        if (hadChunks) this.markLayoutChanged();
    }

    private ensureChunk(chunkIdx: number): void {
        if (chunkIdx < this.data.length) return;
        if (chunkIdx !== this.data.length) {
            throw new Error("Archetype Chunk sequence is not continuous");
        }
        if (chunkIdx > this.maxChunkIdx) {
            throw new RangeError(`Archetype Chunk capacity exceeded: ${this.maxChunkIdx + 1}`);
        }
        const entities = this.entities;
        const views = this.views;
        const table = this.data.push();
        const previousViewCount = views.length;
        const previousEntityCount = entities.length;
        try {
            views.push(this.createViews(table));
            entities.push(table.columns[ENTITY_COLUMN] as unknown as EntitySet);
            this.markLayoutChanged();
        } catch (error) {
            this.views.length = previousViewCount;
            entities.length = previousEntityCount;
            this.data.pop();
            throw error;
        }
    }

    private createViews(table: Table): ComponentViews {
        const types = this.types;
        const count = types.length === 0 ? 0 : types[types.length - 1].id + 1;
        const views: Array<readonly TypedArray[] | undefined> = [];
        views.length = count;
        let columnIdx = ENTITY_COLUMN + 1;
        for (const component of this.types) {
            const fields = new Array<TypedArray>(component.layout.length);
            for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
                fields[fieldIdx] = table.columns[columnIdx++];
            }
            views[component.id] = fields;
        }
        return views;
    }

    private releaseUnusedChunks(): void {
        const keep = this.chunks + RETAIN_EMPTY_CHUNKS;
        while (this.data.length > keep) {
            this.views.pop();
            this.entities.pop();
            this.markLayoutChanged();
            this.data.pop();
        }
    }

    private markLayoutChanged(): void {
        this.version++;
        if (this.onLayoutChange) this.onLayoutChange();
    }

    private assertUsable(): void {
        if (this._disposed) throw new Error("Archetype has been disposed");
    }
}
