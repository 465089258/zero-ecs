import { Disposable } from "../disposable";
import { Buffer } from "../memory";
import { TypedArray, TypedArrayFor, Types } from "../typed-array";
import { TableLayout } from "./types";

export type ColumnsFor<T extends readonly Types[]> = {
    readonly [I in keyof T]: T[I] extends Types ? TypedArrayFor<T[I]> : never
};
/** 一个固定容量的同构 TypedArray 列集合；不记录任何逻辑行状态。 */
export class Table<T extends readonly Types[] = readonly Types[]> extends Disposable {
    readonly columns: ColumnsFor<T>;
    readonly capacity: number;

    /** Table 占用的 Buffer 字节数。 */
    get byteLength(): number { return this.memory.byteLength; }

    /** 使用已分配 Buffer 和预计算布局创建 Table；通常只由 DataSet 调用。 */
    constructor(readonly id: number, protected readonly memory: Buffer, readonly layout: TableLayout) {
        super();
        this.capacity = layout.capacity;
        this.columns = layout.columns.map(column =>
            memory.alloc(column.type, layout.capacity)
        ) as ColumnsFor<T>;
        if (memory.used !== layout.usedBytes) {
            throw new Error("Table layout does not match Buffer allocation");
        }
    }

    /** 返回指定列的 TypedArray 视图。 */
    @Disposable.guard
    column<I extends keyof T>(index: I): ColumnsFor<T>[I] {
        return this.columns[index];
    }

    /** 读取容量范围内指定位置的数据；逻辑行有效性由拥有者负责。 */
    @Disposable.guard
    get(row: number, column: number): number {
        return this.requireColumn(column)[this.requireRow(row)];
    }

    /** 写入容量范围内指定位置的数据；逻辑行有效性由拥有者负责。 */
    @Disposable.guard
    set(row: number, column: number, value: number): void {
        this.requireColumn(column)[this.requireRow(row)] = value;
    }

    /** 将容量范围内指定位置的全部列清零。 */
    @Disposable.guard
    clearRow(row: number): void {
        const index = this.requireRow(row);
        const columns = this.columns as readonly TypedArray[];
        for (let i = 0; i < columns.length; i++) columns[i][index] = 0;
    }

    /** 将一行复制到布局相同的目标 Table；逻辑行状态由调用方负责。 */
    @Disposable.guard
    copyRowTo(sourceRow: number, target: Table<T>, targetRow: number): void {
        const sourceIndex = this.requireRow(sourceRow);
        const targetIndex = target.requireRow(targetRow);
        if (target.layout !== this.layout) {
            throw new Error("Cannot copy between incompatible table layouts");
        }
        const sources = this.columns;
        const targets = target.columns;
        for (let i = 0; i < sources.length; i++) {
            targets[i][targetIndex] = sources[i][sourceIndex];
        }
    }

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
    doDispose() {
        this.memory.dispose();
    }
}
