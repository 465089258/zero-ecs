import { Types } from "../typed-array";
import { type Buffer, type IAllocator } from "../memory";
import { Table } from "./table";
import { TableLayout } from "./types";
import { createTableLayout } from "./layout";
import { Disposable } from "../disposable";

/**
 * 由相同 Schema 和 TableLayout 组成的物理数据集合。
 *
 * DataSet 只在 Table 粒度工作：`push` 创建尾表，`pop` 删除尾表。它不记录行数、
 * 行有效性、结构版本或空表策略；这些状态由 World、Archetype 等拥有者管理。
 */
export class DataSet<
    T extends readonly Types[] = readonly Types[],
    TTable extends Table<T> = Table<T>,
> extends Disposable {
    readonly types: T;
    readonly layout: TableLayout;
    readonly tables: TTable[] = [];

    /** 当前已分配的 Table 数量。 */
    get length(): number { return this.tables.length; }
    /** 当前全部 Table 持有的 Buffer 字节数。 */
    get allocatedBytes(): number { return this.layout.byteLength * this.tables.length; }
    /** 当前 Table 的内部只读视图；Table ID 与数组下标始终相同。 */

    constructor(private readonly allocator: IAllocator, types: T) {
        super();
        this.types = [...types] as unknown as T;
        this.layout = createTableLayout(this.types, allocator.config.bufferByteLength);
    }

    /** 按连续下标读取 Table。 */
    @Disposable.guard
    at(tableId: number): TTable | undefined {
        return this.tables[tableId];
    }

    /** 在尾部创建 Table；返回的 Table ID 等于创建前的 `length`。 */
    @Disposable.guard
    push(): TTable {
        const memory = this.allocator.alloc();
        try {
            if (memory.byteLength !== this.allocator.config.bufferByteLength) {
                throw new Error("Allocator returned a Buffer that does not match allocator.config");
            }
            const table = this.createTable(this.tables.length, memory);
            this.tables.push(table);
            return table;
        } catch (error) {
            memory.dispose();
            throw error;
        }
    }

    @Disposable.guard
    /** 删除并释放最后一个 Table；没有 Table 时返回 `false`。 */
    pop(): boolean {
        const table = this.tables.pop();
        if (!table) return false;
        table.dispose();
        return true;
    }

    /**
     * 使用 DataSet 已确定的布局创建一个物理 Table。
     *
     * 子类只应在这里绑定额外的 Chunk 级视图；行数、版本和保留策略仍由拥有者管理。
     */
    protected createTable(id: number, memory: Buffer): TTable {
        return new Table<T>(id, memory, this.layout) as TTable;
    }

    /** 释放全部 Table；可重复调用。 */
    protected doDispose(): void {
        while (this.tables.length > 0) {
            const table = this.tables.pop();
            if (table) table.dispose();
        }
    }
}
