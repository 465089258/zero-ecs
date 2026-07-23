import { Types } from "../typed-array";
import { type IAllocator } from "../memory";
import { Table } from "./table";
import { TableLayout } from "./types";
import { createTableLayout } from "./layout";
import { Disposable } from "../disposable";

/**
 * 管理一组布局相同的 Table。
 *
 * DataSet 只在 Table 粒度工作：`push` 创建尾表，`pop` 删除尾表。它不记录行数、
 * 行有效性、结构版本或空表策略；这些状态由 World、Archetype 等拥有者管理。
 */
export class DataSet<T extends readonly Types[] = readonly Types[]> extends Disposable {
    readonly types: T;
    readonly layout: TableLayout;
    readonly tables: Table<T>[] = [];

    /** 当前已分配的 Table 数量。 */
    get length(): number { return this.tables.length; }
    /** 当前 Table 的内部只读视图；Table ID 与数组下标始终相同。 */

    constructor(private readonly allocator: IAllocator, types: T) {
        super();
        this.types = [...types] as unknown as T;
        this.layout = createTableLayout(this.types, allocator.config.bufferByteLength);
    }

    /** 按连续下标读取 Table。 */
    @Disposable.guard
    at(tableId: number): Table<T> | undefined {
        return this.tables[tableId];
    }

    /** 在尾部创建 Table；返回的 Table ID 等于创建前的 `length`。 */
    @Disposable.guard
    push(): Table<T> {
        const memory = this.allocator.alloc();
        try {
            if (memory.byteLength !== this.allocator.config.bufferByteLength) {
                throw new Error("Allocator returned a Buffer that does not match allocator.config");
            }
            const table = new Table<T>(this.tables.length, memory, this.layout);
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

    /** 释放全部 Table；可重复调用。 */
    protected doDispose(): void {
        while (this.tables.length > 0) {
            const table = this.tables.pop();
            if (table) table.dispose();
        }
    }
}
