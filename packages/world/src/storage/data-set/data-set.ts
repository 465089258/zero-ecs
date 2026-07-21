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

type ColumnsFor<T extends readonly Types[]> = {
    readonly [I in keyof T]: T[I] extends Types ? TypedArrayFor<T[I]> : never
};

const RELEASE_TABLE: unique symbol = Symbol("releaseTable");

function alignUp(value: number, alignment: number): number {
    return Math.ceil(value / alignment) * alignment;
}

function calculateUsedBytes(types: readonly Types[], capacity: number): number {
    let offset = 0;
    for (const type of types) {
        const bytes = byteSizeOf(type);
        offset = alignUp(offset, bytes) + bytes * capacity;
    }
    return offset;
}

/** 计算一组 TypedArray 列在固定 Buffer 中的最大容量与内存布局。 */
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
    let low = 1;
    let high = Math.floor(bufferByteLength / bytesPerRow);
    let capacity = 0;
    while (low <= high) {
        const middle = (low + high) >>> 1;
        if (calculateUsedBytes(types, middle) <= bufferByteLength) {
            capacity = middle;
            low = middle + 1;
        } else {
            high = middle - 1;
        }
    }
    if (capacity === 0) {
        throw new RangeError(`DataSet row cannot fit into a ${bufferByteLength}-byte Buffer`);
    }
    const columns: ColumnLayout[] = [];
    let offset = 0;
    for (let index = 0; index < types.length; index++) {
        const type = types[index];
        const bytesPerElement = byteSizeOf(type);
        offset = alignUp(offset, bytesPerElement);
        const byteLength = bytesPerElement * capacity;
        columns.push({ index, type, byteOffset: offset, byteLength, bytesPerElement });
        offset += byteLength;
    }
    return { capacity, columns, usedBytes: offset, unusedBytes: bufferByteLength - offset };
}

/** 一个固定容量的同构 TypedArray 列集合；不记录任何逻辑行状态。 */
export class Table<T extends readonly Types[] = readonly Types[]> {
    readonly columns: ColumnsFor<T>;
    readonly capacity: number;

    /** Table 占用的 Buffer 字节数。 */
    get byteLength(): number { return this.memory.byteLength; }

    /** 使用已分配 Buffer 和预计算布局创建 Table；通常只由 DataSet 调用。 */
    constructor(readonly id: number, private readonly memory: Buffer, readonly layout: TableLayout) {
        this.capacity = layout.capacity;
        this.columns = layout.columns.map(column =>
            memory.alloc(column.type, layout.capacity)
        ) as ColumnsFor<T>;
        if (memory.used !== layout.usedBytes) {
            throw new Error("Table layout does not match Buffer allocation");
        }
    }

    /** 返回指定列的 TypedArray 视图。 */
    column<I extends keyof T>(index: I): ColumnsFor<T>[I] {
        return this.columns[index];
    }

    /** 读取容量范围内指定位置的数据；逻辑行有效性由拥有者负责。 */
    get(row: number, column: number): number {
        return this.requireColumn(column)[this.requireRow(row)];
    }

    /** 写入容量范围内指定位置的数据；逻辑行有效性由拥有者负责。 */
    set(row: number, column: number, value: number): void {
        this.requireColumn(column)[this.requireRow(row)] = value;
    }

    /** 将容量范围内指定位置的全部列清零。 */
    clearRow(row: number): void {
        const index = this.requireRow(row);
        const columns = this.columns as readonly TypedArray[];
        for (let i = 0; i < columns.length; i++) columns[i][index] = 0;
    }

    /** 将一行复制到布局相同的目标 Table；逻辑行状态由调用方负责。 */
    copyRowTo(sourceRow: number, target: Table<T>, targetRow: number): void {
        const sourceIndex = this.requireRow(sourceRow);
        const targetIndex = target.requireRow(targetRow);
        if (target.layout !== this.layout) {
            throw new Error("Cannot copy between incompatible table layouts");
        }
        const sources = this.columns as readonly TypedArray[];
        const targets = target.columns as readonly TypedArray[];
        for (let i = 0; i < sources.length; i++) {
            targets[i][targetIndex] = sources[i][sourceIndex];
        }
    }

    /** 仅供所属 DataSet 在 `pop` 时释放底层 Buffer。 */
    [RELEASE_TABLE](): void { this.memory.dispose(); }

    private requireRow(row: number): number {
        if (!Number.isInteger(row) || row < 0 || row >= this.capacity) {
            throw new RangeError(`Invalid table row: ${row}`);
        }
        return row;
    }

    private requireColumn(column: number): TypedArray {
        if (!Number.isInteger(column) || column < 0) {
            throw new RangeError(`Invalid column: ${column}`);
        }
        const view = (this.columns as readonly TypedArray[])[column];
        if (!view) throw new RangeError(`Invalid column: ${column}`);
        return view;
    }
}

/**
 * 管理一组布局相同的 Table。
 *
 * DataSet 只在 Table 粒度工作：`push` 创建尾表，`pop` 删除尾表。它不记录行数、
 * 行有效性、结构版本或空表策略；这些状态由 Archetype、EntitySlots 等拥有者管理。
 */
export class DataSet<T extends readonly Types[] = readonly Types[]> {
    readonly types: T;
    readonly layout: TableLayout;
    private readonly _tables: Table<T>[] = [];
    private _disposed = false;

    /** 当前已分配的 Table 数量。 */
    get length(): number { return this._tables.length; }
    /** 当前 Table 的内部只读视图；Table ID 与数组下标始终相同。 */
    get tables(): readonly Table<T>[] { return this._tables; }

    constructor(private readonly allocator: IAllocator, types: T) {
        this.types = [...types] as unknown as T;
        this.layout = createTableLayout(this.types, allocator.config.bufferByteLength);
    }

    /** 按连续下标读取 Table。 */
    at(tableId: number): Table<T> | undefined {
        if (this._disposed || !Number.isInteger(tableId) || tableId < 0) return undefined;
        return this._tables[tableId];
    }

    /** 在尾部创建 Table；返回的 Table ID 等于创建前的 `length`。 */
    push(): Table<T> {
        this.assertUsable();
        const memory = this.allocator.alloc();
        try {
            if (memory.byteLength !== this.allocator.config.bufferByteLength) {
                throw new Error("Allocator returned a Buffer that does not match allocator.config");
            }
            const table = new Table<T>(this._tables.length, memory, this.layout);
            this._tables.push(table);
            return table;
        } catch (error) {
            memory.dispose();
            throw error;
        }
    }

    /** 删除并释放最后一个 Table；没有 Table 时返回 `false`。 */
    pop(): boolean {
        this.assertUsable();
        const table = this._tables.pop();
        if (!table) return false;
        table[RELEASE_TABLE]();
        return true;
    }

    /** 释放全部 Table；可重复调用。 */
    dispose(): void {
        if (this._disposed) return;
        while (this._tables.length > 0) this.pop();
        this._disposed = true;
    }

    private assertUsable(): void {
        if (this._disposed) throw new Error("DataSet has been disposed");
    }
}
