import { byteSizeOf, createTypedArray, type TypedArray, type TypedArrayFor, Types } from "../typed-array";
import { CHUNK_SIZE, type IChunkAllocator, type MemoryChunk } from "../memory";

export interface ColumnLayout { readonly index: number; readonly type: Types; readonly byteOffset: number; readonly byteLength: number; readonly bytesPerElement: number }
export interface TableLayout { readonly capacity: number; readonly columns: readonly ColumnLayout[]; readonly usedBytes: number; readonly unusedBytes: number }
declare const DATA_ROW_BRAND: unique symbol;
/** Allocation-free packed row handle. The low 14 bits address a row in one 16 KiB Table. */
export type DataRow = number & { readonly [DATA_ROW_BRAND]: true };
export const RemoveResult = Object.freeze({ Invalid: 0, Removed: 1, Moved: 2 } as const);
export type RemoveResult = typeof RemoveResult[keyof typeof RemoveResult];
export interface DataSetOptions { readonly retainEmptyTables?: number }
type ColumnsFor<T extends readonly Types[]> = { readonly [I in keyof T]: T[I] extends Types ? TypedArrayFor<T[I]> : never };

const DATA_ROW_STRIDE = CHUNK_SIZE;
// Entity slot storage reserves 0xFFFFFFFF as NONE and stores Table ids in U32.
// Keeping the shared DataRow format inside that boundary avoids truncation.
const MAX_TABLE_ID = 0xFFFFFFFE;

/** @internal Packs a Table id and row without allocating an object. */
export function dataRowAt(tableId: number, row: number): DataRow {
    return (tableId * DATA_ROW_STRIDE + row) as DataRow;
}
export function dataRowTableId(location: DataRow): number { return Math.floor(location / DATA_ROW_STRIDE); }
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

export class Table<T extends readonly Types[] = readonly Types[]> {
    readonly columns: ColumnsFor<T>;
    readonly capacity: number;
    private _count = 0;
    get count(): number { return this._count; }
    get full(): boolean { return this._count === this.capacity; }
    get empty(): boolean { return this._count === 0; }

    constructor(readonly id: number, readonly memory: MemoryChunk, readonly layout: TableLayout) {
        this.capacity = layout.capacity;
        this.columns = layout.columns.map(column => createTypedArray(column.type, memory.buffer, memory.byteOffset + column.byteOffset, layout.capacity)) as ColumnsFor<T>;
    }
    column<I extends keyof T>(index: I): ColumnsFor<T>[I] { return this.columns[index]; }
    allocRow(clear = true): number { if (this.full) throw new RangeError("Table is full"); const row = this._count++; if (clear) this.clearRow(row); return row; }
    popRow(): void { if (this.empty) throw new RangeError("Table is empty"); this._count--; }
    clearRow(row: number): void { this.assertRow(row); const columns = this.columns as readonly TypedArray[]; for (let i = 0; i < columns.length; i++) columns[i][row] = 0; }
    copyRowTo(sourceRow: number, target: Table<T>, targetRow: number): void {
        this.assertRow(sourceRow); target.assertRow(targetRow);
        if (target.layout !== this.layout) throw new Error("Cannot copy between incompatible table layouts");
        const sources = this.columns as readonly TypedArray[], targets = target.columns as readonly TypedArray[];
        for (let i = 0; i < sources.length; i++) targets[i][targetRow] = sources[i][sourceRow];
    }
    private assertRow(row: number): void { if (!Number.isInteger(row) || row < 0 || row >= this._count) throw new RangeError(`Invalid table row: ${row}`); }
}

export class DataSet<T extends readonly Types[] = readonly Types[]> {
    readonly types: T;
    readonly layout: TableLayout;
    private readonly _tables: Table<T>[] = [];
    private readonly _tableById = new Map<number, Table<T>>();
    private _nextTableId = 0;
    private _count = 0;
    private _version = 0;
    private _disposed = false;
    get count(): number { return this._count; }
    /** Changes only when Table views are created or released. */
    get version(): number { return this._version; }
    get tables(): readonly Table<T>[] { return this._tables; }

    constructor(private readonly allocator: IChunkAllocator, types: T, private readonly options: DataSetOptions = {}) {
        this.types = [...types] as unknown as T;
        this.layout = createTableLayout(this.types);
    }
    insert(): DataRow {
        this.assertUsable();
        let table = this._tables[this._tables.length - 1];
        if (!table || table.full) table = this.createTable();
        const row = table.allocRow(); this._count++;
        return dataRowAt(table.id, row);
    }
    remove(location: DataRow): RemoveResult {
        this.assertUsable();
        if (!Number.isSafeInteger(location) || location < 0) return RemoveResult.Invalid;
        const tableId = dataRowTableId(location), row = dataRowIndex(location);
        const target = this._tableById.get(tableId);
        if (!target || row < 0 || row >= target.count) return RemoveResult.Invalid;
        const last = this._tables[this._tables.length - 1], lastRow = last.count - 1;
        const same = target === last && row === lastRow;
        if (!same) last.copyRowTo(lastRow, target, row);
        last.popRow(); this._count--; this.releaseExcessEmptyTables();
        return same ? RemoveResult.Removed : RemoveResult.Moved;
    }
    valid(location: DataRow): boolean {
        if (this._disposed || !Number.isSafeInteger(location) || location < 0) return false;
        const row = dataRowIndex(location);
        const table = this._tableById.get(dataRowTableId(location));
        return !!table && row >= 0 && row < table.count;
    }
    validAt(tableId: number, row: number): boolean {
        const table = this._tableById.get(tableId);
        return !this._disposed && !!table && Number.isInteger(row) && row >= 0 && row < table.count;
    }
    table(tableId: number): Table<T> | undefined { return this._tableById.get(tableId); }
    get(location: DataRow, column: number): number {
        const row = dataRowIndex(location);
        return this.requireColumnAt(dataRowTableId(location), row, column)[row];
    }
    set(location: DataRow, column: number, value: number): void {
        const row = dataRowIndex(location);
        this.requireColumnAt(dataRowTableId(location), row, column)[row] = value;
    }
    getAt(tableId: number, row: number, column: number): number {
        return this.requireColumnAt(tableId, row, column)[row];
    }
    setAt(tableId: number, row: number, column: number, value: number): void {
        this.requireColumnAt(tableId, row, column)[row] = value;
    }
    clear(): void { this.assertUsable(); for (const table of this._tables) while (!table.empty) table.popRow(); this._count = 0; this.releaseExcessEmptyTables(); }
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
