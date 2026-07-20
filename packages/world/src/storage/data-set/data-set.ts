import { byteSizeOf, type TypedArray, type TypedArrayFor, Types } from "../typed-array";
import { type Buffer, type IAllocator } from "../memory";

/** 单列在 Table Buffer 中的内存布局。 */
export interface ColumnLayout {
    readonly index: number;
    readonly type: Types;
    readonly byteOffset: number;
    readonly byteLength: number;
    readonly bytesPerElement: number;
}

/** 一个固定大小 Table Buffer 的容量与列布局。 */
export interface TableLayout {
    readonly capacity: number;
    readonly columns: readonly ColumnLayout[];
    readonly usedBytes: number;
    readonly unusedBytes: number;
}

declare const DATA_ROW_BRAND: unique symbol;

/** 无对象分配的 U32 物理行位置；编码只在所属 DataSet 的当前结构版本内有效。 */
export type DataRow = number & { readonly [DATA_ROW_BRAND]: true };

/** 保留给外部存储和实体槽位使用的无效 DataRow。 */
export const INVALID_DATA_ROW = 0xFFFFFFFF as DataRow;

/** DataSet 删除结果；`Moved` 表示末行已移动到被删除位置。 */
export enum RemoveResult {
    /** 无效移除 */
    Invalid,
    /** 已移除的无移动 */
    Removed,
    /** 末行已移动到删除位置 */
    Moved
};

/** DataSet 的内存保留策略。 */
export interface DataSetOptions { readonly retainEmptyTables?: number }

type ColumnsFor<T extends readonly Types[]> = { readonly [I in keyof T]: T[I] extends Types ? TypedArrayFor<T[I]> : never };

// 0xFFFFFFFF 保留为无效位置，其余 U32 值均可用于 DataRow 编码。
const MAX_DATA_ROW = 0xFFFFFFFE;

function alignUp(value: number, alignment: number): number {
    return Math.ceil(value / alignment) * alignment;
}

function calculateUsedBytes(types: readonly Types[], capacity: number): number {
    let offset = 0;
    for (const type of types) { const bytes = byteSizeOf(type); offset = alignUp(offset, bytes) + bytes * capacity; }
    return offset;
}

/** 计算一组 TypedArray 列在固定 Buffer 中的最大行容量与内存布局。 */
export function createTableLayout(
    types: readonly Types[],
    bufferByteLength: number,
): TableLayout {
    if (types.length === 0) throw new Error("DataSet requires at least one column");
    if (!Number.isInteger(bufferByteLength) || bufferByteLength <= 0) {
        throw new RangeError("bufferByteLength must be a positive integer");
    }
    let bytesPerRow = 0;
    for (const type of types) bytesPerRow += byteSizeOf(type);
    let low = 1, high = Math.floor(bufferByteLength / bytesPerRow), capacity = 0;
    while (low <= high) {
        const middle = (low + high) >>> 1;
        if (calculateUsedBytes(types, middle) <= bufferByteLength) { capacity = middle; low = middle + 1; }
        else high = middle - 1;
    }
    if (capacity === 0) {
        throw new RangeError(`DataSet row cannot fit into a ${bufferByteLength}-byte Buffer`);
    }
    const columns: ColumnLayout[] = [];
    let offset = 0;
    for (let index = 0; index < types.length; index++) {
        const type = types[index], bytesPerElement = byteSizeOf(type);
        offset = alignUp(offset, bytesPerElement);
        const byteLength = bytesPerElement * capacity;
        columns.push({ index, type, byteOffset: offset, byteLength, bytesPerElement });
        offset += byteLength;
    }
    return { capacity, columns, usedBytes: offset, unusedBytes: bufferByteLength - offset };
}

/** 使用一个固定 Buffer 保存多列 TypedArray 的行表。 */
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
    /** Table 当前占用的 Buffer 字节数。 */
    get byteLength(): number { return this.memory.byteLength; }

    /** 使用已分配 Buffer 和预计算布局创建 Table；通常由 DataSet 调用。 */
    constructor(readonly id: number, private readonly memory: Buffer, readonly layout: TableLayout) {
        this.capacity = layout.capacity;
        this.columns = layout.columns.map(column =>
            memory.alloc(column.type, layout.capacity)
        ) as ColumnsFor<T>;
        if (memory.used !== layout.usedBytes) throw new Error("Table layout does not match Buffer allocation");
    }

    /** 返回指定列的 TypedArray 视图。 */
    column<I extends keyof T>(index: I): ColumnsFor<T>[I] {
        return this.columns[index];
    }

    /** 在末尾分配一行；默认将全部字段不清零。 */
    allocRow(clear = false): number {
        if (this.full) throw new RangeError("Table is full");
        const row = this._count++;
        if (clear) this.clearRow(row);
        return row;
    }

    /** 删除末行但不清除其底层数据。 */
    popRow(): void {
        if (this.empty) throw new RangeError("Table is empty");
        this._count--;
    }

    /** 将有效行的全部列清零。 */
    clearRow(row: number): void {
        this.assertRow(row);
        const columns = this.columns as readonly TypedArray[];
        for (let i = 0; i < columns.length; i++) columns[i][row] = 0;
    }

    /** 将一行复制到布局相同的目标 Table。 */
    copyRowTo(sourceRow: number, target: Table<T>, targetRow: number): void {
        this.assertRow(sourceRow); target.assertRow(targetRow);
        if (target.layout !== this.layout) throw new Error("Cannot copy between incompatible table layouts");
        const sources = this.columns as readonly TypedArray[];
        const targets = target.columns as readonly TypedArray[];
        for (let i = 0; i < sources.length; i++) targets[i][targetRow] = sources[i][sourceRow];
    }

    /** @internal 将 Table 占用的 Buffer 归还给 Allocator。 */
    release(): void { this.memory.dispose(); }

    private assertRow(row: number): void {
        if (!Number.isInteger(row) || row < 0 || row >= this._count)
            throw new RangeError(`Invalid table row: ${row}`);
    }
}

/** 以 Allocator 实例配置的固定大小 Buffer 组织同构 TypedArray 行数据。 */
export class DataSet<T extends readonly Types[] = readonly Types[]> {
    readonly types: T;
    readonly layout: TableLayout;
    private readonly _tables: Table<T>[] = [];
    private readonly _tableById = new Map<number, Table<T>>();
    private readonly _freeTableIds: number[] = [];
    private readonly _maxTableId: number;
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

    /** 创建列类型固定的 DataSet；每个 Table 占用一个 Buffer。 */
    constructor(private readonly allocator: IAllocator, types: T, private readonly options: DataSetOptions = {}) {
        this.types = [...types] as unknown as T;
        this.layout = createTableLayout(this.types, allocator.config.bufferByteLength);
        if (this.layout.capacity > MAX_DATA_ROW + 1) {
            throw new RangeError(
                `DataSet capacity ${this.layout.capacity} exceeds the U32 DataRow address space`,
            );
        }
        this._maxTableId = Math.floor(
            (MAX_DATA_ROW - (this.layout.capacity - 1)) / this.layout.capacity,
        );
    }
    /** 分配一行并返回紧凑位置句柄；新行全部清零。 */
    insert(): DataRow {
        this.assertUsable();
        let table = this._tables[this._tables.length - 1];
        if (!table || table.full) table = this.createTable();
        const row = table.allocRow(); this._count++;
        return this.locationAt(table.id, row);
    }

    /** @internal 将当前 DataSet 的 Table ID 和行索引编码为可存入 Uint32Array 的物理位置。 */
    locationAt(tableId: number, row: number): DataRow {
        return (tableId * this.layout.capacity + row) as DataRow;
    }

    /** 从当前 DataSet 的物理位置解码 Table ID。 */
    tableIdOf(location: DataRow): number {
        return Math.floor(location / this.layout.capacity);
    }

    /** 从当前 DataSet 的物理位置解码 Table 内行索引；零是有效索引。 */
    rowIndexOf(location: DataRow): number {
        const tableId = Math.floor(location / this.layout.capacity);
        return location - tableId * this.layout.capacity;
    }
    /**
     * 删除指定行，并用最后一个有效行填补空位。
     *
     * 返回 `Moved` 时，调用方必须同步更新被移动对象的位置索引。
     */
    remove(location: DataRow): RemoveResult {
        this.assertUsable();
        if (!Number.isInteger(location) || location < 0 || location > MAX_DATA_ROW) return RemoveResult.Invalid;
        const tableId = this.tableIdOf(location), row = this.rowIndexOf(location);
        const target = this._tableById.get(tableId);
        if (!target || row < 0 || row >= target.count) return RemoveResult.Invalid;
        const last = this.lastOccupiedTable();
        if (!last) return RemoveResult.Invalid;
        const lastRow = last.count - 1;
        const same = target === last && row === lastRow;
        if (!same) last.copyRowTo(lastRow, target, row);
        last.popRow();
        this._count--;
        this.releaseExcessEmptyTables();
        return same ? RemoveResult.Removed : RemoveResult.Moved;
    }
    /** 判断 DataRow 当前是否指向有效行。 */
    valid(location: DataRow): boolean {
        if (this._disposed || !Number.isInteger(location) || location < 0 || location > MAX_DATA_ROW) return false;
        const row = this.rowIndexOf(location);
        const table = this._tableById.get(this.tableIdOf(location));
        return !!table && row >= 0 && row < table.count;
    }
    /** 判断指定 Table ID 与行索引是否有效。 */
    validAt(tableId: number, row: number): boolean {
        const table = this._tableById.get(tableId);
        return !this._disposed && !!table && Number.isInteger(row) && row >= 0 && row < table.count;
    }
    /** 根据当前有效 Table ID 获取 Table；释放后的 ID 可以由新 Table 复用。 */
    table(tableId: number): Table<T> | undefined { return this._tableById.get(tableId); }
    /** 读取 DataRow 指向行的指定列。 */
    get(location: DataRow, column: number): number {
        const row = this.rowIndexOf(location);
        return this.requireColumnAt(this.tableIdOf(location), row, column)[row];
    }
    /** 写入 DataRow 指向行的指定列。 */
    set(location: DataRow, column: number, value: number): void {
        const row = this.rowIndexOf(location);
        this.requireColumnAt(this.tableIdOf(location), row, column)[row] = value;
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
    /** 释放全部 Table Buffer；可重复调用。 */
    dispose(): void {
        if (this._disposed) return;
        for (const table of this._tables) table.release();
        if (this._tables.length > 0) this._version++;
        this._tables.length = 0; this._tableById.clear(); this._freeTableIds.length = 0;
        this._count = 0; this._disposed = true;
    }
    private createTable(): Table<T> {
        const reused = this._freeTableIds.length > 0;
        const tableId = reused ? this._freeTableIds.pop()! : this._nextTableId;
        if (tableId > this._maxTableId) {
            if (reused) this._freeTableIds.push(tableId);
            throw new RangeError(`DataSet active Table capacity exceeded: ${this._maxTableId + 1}`);
        }
        const memory = this.allocator.alloc();
        try {
            if (memory.byteLength !== this.allocator.config.bufferByteLength) {
                throw new Error("Allocator returned a Buffer that does not match allocator.config");
            }
            const table = new Table<T>(tableId, memory, this.layout);
            if (!reused) this._nextTableId++;
            this._tables.push(table); this._tableById.set(table.id, table); this._version++; return table;
        } catch (error) {
            if (reused) this._freeTableIds.push(tableId);
            memory.dispose();
            throw error;
        }
    }
    private releaseExcessEmptyTables(): void {
        const retain = Math.max(0, this.options.retainEmptyTables ?? 1);
        let emptyCount = 0; for (const table of this._tables) if (table.empty) emptyCount++;
        while (emptyCount > retain) {
            const last = this._tables[this._tables.length - 1]; if (!last.empty) break;
            this._tables.pop(); this._tableById.delete(last.id); last.release();
            this._freeTableIds.push(last.id); this._version++; emptyCount--;
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
