import { byteSizeOf, createTypedArray, type TypedArray, type TypedArrayFor, Types } from "../typed-array";
import { CHUNK_SIZE, type IChunkAllocator, type MemoryChunk } from "../memory";

/** 单列在 Table Chunk 中的内存布局。 */
export interface ColumnLayout { readonly index: number; readonly type: Types; readonly byteOffset: number; readonly byteLength: number; readonly bytesPerElement: number }
/** 一个固定大小 Table 的容量与列布局。 */
export interface TableLayout { readonly capacity: number; readonly columns: readonly ColumnLayout[]; readonly usedBytes: number; readonly unusedBytes: number }
declare const DATA_ROW_BRAND: unique symbol;
/** 无对象分配的紧凑行句柄；低 14 位表示 16 KiB Table 内的行索引。 */
export type DataRow = number & { readonly [DATA_ROW_BRAND]: true };
/** DataSet 删除结果；`Moved` 表示末行已移动到被删除位置。 */
export const RemoveResult = Object.freeze({ Invalid: 0, Removed: 1, Moved: 2 } as const);
/** DataSet 删除结果值。 */
export type RemoveResult = typeof RemoveResult[keyof typeof RemoveResult];
/** DataSet 的内存保留策略。 */
export interface DataSetOptions { readonly retainEmptyTables?: number }
type ColumnsFor<T extends readonly Types[]> = { readonly [I in keyof T]: T[I] extends Types ? TypedArrayFor<T[I]> : never };

const DATA_ROW_STRIDE = CHUNK_SIZE;
// 实体槽位以 U32 保存 Table ID，并保留 0xFFFFFFFF 表示空位置。
const MAX_TABLE_ID = 0xFFFFFFFE;

/** @internal 将 Table ID 与行索引编码为不分配对象的 DataRow。 */
export function dataRowAt(tableId: number, row: number): DataRow {
    return (tableId * DATA_ROW_STRIDE + row) as DataRow;
}
/** 从 DataRow 解码 Table ID。 */
export function dataRowTableId(location: DataRow): number { return Math.floor(location / DATA_ROW_STRIDE); }
/** 从 DataRow 解码行索引；零是有效索引。 */
export function dataRowIndex(location: DataRow): number {
    const tableId = Math.floor(location / DATA_ROW_STRIDE);
    return location - tableId * DATA_ROW_STRIDE;
}

function alignUp(value: number, alignment: number): number { return Math.ceil(value / alignment) * alignment; }
function calculateUsedBytes(types: readonly Types[], capacity: number): number {
    let offset = 0;
    for (const type of types) { const bytes = byteSizeOf(type); offset = alignUp(offset, bytes) + bytes * capacity; }
    return offset;
}

/** 计算一组 TypedArray 列在固定 Chunk 中的最大行容量与内存布局。 */
export function createTableLayout(types: readonly Types[], chunkSize = CHUNK_SIZE): TableLayout {
    if (types.length === 0) throw new Error("DataSet requires at least one column");
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) throw new RangeError("chunkSize must be a positive integer");
    let bytesPerRow = 0;
    for (const type of types) bytesPerRow += byteSizeOf(type);
    let low = 1, high = Math.floor(chunkSize / bytesPerRow), capacity = 0;
    while (low <= high) {
        const middle = (low + high) >>> 1;
        if (calculateUsedBytes(types, middle) <= chunkSize) { capacity = middle; low = middle + 1; }
        else high = middle - 1;
    }
    if (capacity === 0) throw new RangeError(`DataSet row cannot fit into a ${chunkSize}-byte chunk`);
    const columns: ColumnLayout[] = [];
    let offset = 0;
    for (let index = 0; index < types.length; index++) {
        const type = types[index], bytesPerElement = byteSizeOf(type);
        offset = alignUp(offset, bytesPerElement);
        const byteLength = bytesPerElement * capacity;
        columns.push({ index, type, byteOffset: offset, byteLength, bytesPerElement });
        offset += byteLength;
    }
    return { capacity, columns, usedBytes: offset, unusedBytes: chunkSize - offset };
}

/** 使用一个固定 Chunk 保存多列 TypedArray 的行表。 */
export class Table<T extends readonly Types[] = readonly Types[]> {
    readonly columns: ColumnsFor<T>;
    readonly capacity: number;
    private _count = 0;
    /** 当前有效行数。 */
    get count(): number { return this._count; }
    /** Table 是否已达到布局容量。 */
    get full(): boolean { return this._count === this.capacity; }
    /** Table 是否没有有效行。 */
    get empty(): boolean { return this._count === 0; }

    /** 使用已分配 Chunk 和预计算布局创建 Table；通常由 DataSet 调用。 */
    constructor(readonly id: number, readonly memory: MemoryChunk, readonly layout: TableLayout) {
        this.capacity = layout.capacity;
        this.columns = layout.columns.map(column => createTypedArray(column.type, memory.buffer, memory.byteOffset + column.byteOffset, layout.capacity)) as ColumnsFor<T>;
    }
    /** 返回指定列的 TypedArray 视图。 */
    column<I extends keyof T>(index: I): ColumnsFor<T>[I] { return this.columns[index]; }
    /** 在末尾分配一行；默认将全部字段清零。 */
    allocRow(clear = true): number { if (this.full) throw new RangeError("Table is full"); const row = this._count++; if (clear) this.clearRow(row); return row; }
    /** 删除末行但不清除其底层数据。 */
    popRow(): void { if (this.empty) throw new RangeError("Table is empty"); this._count--; }
    /** 将有效行的全部列清零。 */
    clearRow(row: number): void { this.assertRow(row); const columns = this.columns as readonly TypedArray[]; for (let i = 0; i < columns.length; i++) columns[i][row] = 0; }
    /** 将一行复制到布局相同的目标 Table。 */
    copyRowTo(sourceRow: number, target: Table<T>, targetRow: number): void {
        this.assertRow(sourceRow); target.assertRow(targetRow);
        if (target.layout !== this.layout) throw new Error("Cannot copy between incompatible table layouts");
        const sources = this.columns as readonly TypedArray[], targets = target.columns as readonly TypedArray[];
        for (let i = 0; i < sources.length; i++) targets[i][targetRow] = sources[i][sourceRow];
    }
    private assertRow(row: number): void { if (!Number.isInteger(row) || row < 0 || row >= this._count) throw new RangeError(`Invalid table row: ${row}`); }
}

/** 以固定 16 KiB Table 组织同构 TypedArray 行数据的存储集合。 */
export class DataSet<T extends readonly Types[] = readonly Types[]> {
    readonly types: T;
    readonly layout: TableLayout;
    private readonly _tables: Table<T>[] = [];
    private readonly _tableById = new Map<number, Table<T>>();
    private _nextTableId = 0;
    private _count = 0;
    private _version = 0;
    private _disposed = false;
    /** 当前有效行总数。 */
    get count(): number { return this._count; }
    /** Table 视图创建或释放时递增；单纯增删行不会改变。 */
    get version(): number { return this._version; }
    /** 当前仍由 DataSet 持有的 Table 只读列表。 */
    get tables(): readonly Table<T>[] { return this._tables; }

    /** 创建列类型固定的 DataSet；每个 Table 占用一个 Chunk。 */
    constructor(private readonly allocator: IChunkAllocator, types: T, private readonly options: DataSetOptions = {}) {
        this.types = [...types] as unknown as T;
        this.layout = createTableLayout(this.types);
    }
    /** 分配一行并返回紧凑位置句柄；新行全部清零。 */
    insert(): DataRow {
        this.assertUsable();
        let table = this._tables[this._tables.length - 1];
        if (!table || table.full) table = this.createTable();
        const row = table.allocRow(); this._count++;
        return dataRowAt(table.id, row);
    }
    /**
     * 删除指定行，并用最后一个有效行填补空位。
     *
     * 返回 `Moved` 时，调用方必须同步更新被移动对象的位置索引。
     */
    remove(location: DataRow): RemoveResult {
        this.assertUsable();
        if (!Number.isSafeInteger(location) || location < 0) return RemoveResult.Invalid;
        const tableId = dataRowTableId(location), row = dataRowIndex(location);
        const target = this._tableById.get(tableId);
        if (!target || row < 0 || row >= target.count) return RemoveResult.Invalid;
        const last = this.lastOccupiedTable();
        if (!last) return RemoveResult.Invalid;
        const lastRow = last.count - 1;
        const same = target === last && row === lastRow;
        if (!same) last.copyRowTo(lastRow, target, row);
        last.popRow(); this._count--; this.releaseExcessEmptyTables();
        return same ? RemoveResult.Removed : RemoveResult.Moved;
    }
    /** 判断 DataRow 当前是否指向有效行。 */
    valid(location: DataRow): boolean {
        if (this._disposed || !Number.isSafeInteger(location) || location < 0) return false;
        const row = dataRowIndex(location);
        const table = this._tableById.get(dataRowTableId(location));
        return !!table && row >= 0 && row < table.count;
    }
    /** 判断指定 Table ID 与行索引是否有效。 */
    validAt(tableId: number, row: number): boolean {
        const table = this._tableById.get(tableId);
        return !this._disposed && !!table && Number.isInteger(row) && row >= 0 && row < table.count;
    }
    /** 根据稳定 Table ID 获取 Table；已释放时返回 `undefined`。 */
    table(tableId: number): Table<T> | undefined { return this._tableById.get(tableId); }
    /** 读取 DataRow 指向行的指定列。 */
    get(location: DataRow, column: number): number {
        const row = dataRowIndex(location);
        return this.requireColumnAt(dataRowTableId(location), row, column)[row];
    }
    /** 写入 DataRow 指向行的指定列。 */
    set(location: DataRow, column: number, value: number): void {
        const row = dataRowIndex(location);
        this.requireColumnAt(dataRowTableId(location), row, column)[row] = value;
    }
    /** 使用 Table ID 和行索引读取指定列。 */
    getAt(tableId: number, row: number, column: number): number {
        return this.requireColumnAt(tableId, row, column)[row];
    }
    /** 使用 Table ID 和行索引写入指定列。 */
    setAt(tableId: number, row: number, column: number, value: number): void {
        this.requireColumnAt(tableId, row, column)[row] = value;
    }
    /** 删除全部行，并按配置保留空 Table。 */
    clear(): void { this.assertUsable(); for (const table of this._tables) while (!table.empty) table.popRow(); this._count = 0; this.releaseExcessEmptyTables(); }
    /** 释放全部 Table Chunk；可重复调用。 */
    dispose(): void {
        if (this._disposed) return;
        for (const table of this._tables) this.allocator.free(table.memory.handle);
        if (this._tables.length > 0) this._version++;
        this._tables.length = 0; this._tableById.clear(); this._count = 0; this._disposed = true;
    }
    private createTable(): Table<T> {
        if (this._nextTableId > MAX_TABLE_ID) throw new RangeError(`DataSet Table id capacity exceeded: ${MAX_TABLE_ID}`);
        const table = new Table<T>(this._nextTableId++, this.allocator.alloc(), this.layout);
        this._tables.push(table); this._tableById.set(table.id, table); this._version++; return table;
    }
    private releaseExcessEmptyTables(): void {
        const retain = Math.max(0, this.options.retainEmptyTables ?? 1);
        let emptyCount = 0; for (const table of this._tables) if (table.empty) emptyCount++;
        while (emptyCount > retain) {
            const last = this._tables[this._tables.length - 1]; if (!last.empty) break;
            this._tables.pop(); this._tableById.delete(last.id); this.allocator.free(last.memory.handle); this._version++; emptyCount--;
        }
    }
    private lastOccupiedTable(): Table<T> | undefined {
        for (let i = this._tables.length - 1; i >= 0; i--) {
            const table = this._tables[i];
            if (!table.empty) return table;
        }
        return undefined;
    }
    private requireColumnAt(tableId: number, row: number, column: number): TypedArray {
        this.assertUsable();
        const table = this._tableById.get(tableId);
        if (!table || !Number.isInteger(row) || row < 0 || row >= table.count) throw new RangeError("Invalid data row");
        const view = (table.columns as readonly TypedArray[])[column];
        if (!view) throw new RangeError(`Invalid column: ${column}`);
        return view;
    }
    private assertUsable(): void { if (this._disposed) throw new Error("DataSet has been disposed"); }
}
