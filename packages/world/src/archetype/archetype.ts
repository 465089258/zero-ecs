import {
    DataSet,
    RemoveResult,
    type DataRow,
    type Table,
} from "../storage/data-set";
import type { IAllocator } from "../storage/memory";
import { type TypedArray, Types } from "../storage/typed-array";
import { type ComponentId, type ComponentMeta } from "../component/component";
import { Mask } from "../component/mask";
import type { Entity } from "../entity/entity";

/** Archetype DataSet 中保存实体句柄的列索引。 */
export const ENTITY_COLUMN = 0;

/** 实体在 Archetype DataSet 中的紧凑行位置。 */
export type ArchetypeRow = DataRow;

/** 组件集合相同的实体存储；每个底层 Table 占用一个 Allocator Buffer。 */
export class Archetype {
    readonly mask: Mask;
    readonly name: string;
    readonly data: DataSet;
    private readonly _types: ComponentMeta[];
    private readonly _componentColumns: Array<readonly number[] | undefined>;
    private readonly _tableComponentViews = new WeakMap<Table, Array<readonly TypedArray[] | undefined>>();

    /** 当前实体数量。 */
    get count(): number { return this.data.count; }
    /** 按组件编号排序的组件元数据。 */
    get types(): ReadonlyArray<ComponentMeta> { return this._types; }
    /** 当前持有的 Table 列表。 */
    get tables(): readonly Table[] { return this.data.tables; }

    /** 创建指定组件掩码对应的 Archetype。 */
    constructor(mask: Mask, types: readonly ComponentMeta[] | undefined, allocator: IAllocator) {
        this.mask = mask.clone();
        this._types = types === undefined ? [] : [...types].sort((a, b) => a.id - b.id);
        const maxId = this._types.length === 0 ? -1 : this._types[this._types.length - 1].id;
        this._componentColumns = new Array(maxId + 1).fill(undefined);
        const columnTypes: Types[] = [Types.U32];
        const names: string[] = [];
        for (const comp of this._types) {
            const columns: number[] = [];
            for (const fieldType of comp.layout) {
                columns.push(columnTypes.length);
                columnTypes.push(fieldType);
            }
            this._componentColumns[comp.id] = columns;
            names.push(comp.name);
        }
        this.name = names.join(" | ");
        this.data = new DataSet(allocator, columnTypes, { retainEmptyTables: 1 });
    }

    /** 插入实体并返回其行位置；所有组件字段初始为零。 */
    insert(entity: Entity): ArchetypeRow {
        const location = this.data.insert();
        this.data.set(location, ENTITY_COLUMN, entity);
        return location;
    }

    /** 删除实体行；发生末行填补时返回被移动实体。 */
    remove(location: ArchetypeRow): Entity | undefined {
        if (!this.data.valid(location)) return undefined;
        const result = this.data.remove(location);
        return result === RemoveResult.Moved
            ? this.data.get(location, ENTITY_COLUMN) as Entity
            : undefined;
    }

    /** 获取指定位置的实体句柄；位置无效时返回 `undefined`。 */
    getEntity(location: ArchetypeRow): Entity | undefined {
        return this.data.valid(location) ? this.data.get(location, ENTITY_COLUMN) as Entity : undefined;
    }

    /** 读取组件字段；位置、组件或字段无效时返回 `null`。 */
    getField(location: ArchetypeRow, compId: ComponentId, fieldId: number): number | null {
        const column = this._componentColumns[compId]?.[fieldId];
        if (column === undefined || !this.data.valid(location)) return null;
        return this.data.get(location, column);
    }

    /** 写入组件字段；位置、组件或字段无效时返回 `false`。 */
    setField(location: ArchetypeRow, compId: ComponentId, fieldId: number, value: number): boolean {
        const column = this._componentColumns[compId]?.[fieldId];
        if (column === undefined || !this.data.valid(location)) return false;
        this.data.set(location, column, value);
        return true;
    }

    /** 使用 Table ID 和行索引直接写入组件字段。 */
    setFieldAt(tableId: number, row: number, compId: ComponentId, fieldId: number, value: number): boolean {
        const column = this._componentColumns[compId]?.[fieldId];
        if (column === undefined || !this.data.validAt(tableId, row)) return false;
        this.data.setAt(tableId, row, column, value);
        return true;
    }

    /** 返回实体所在 Table 的组件列视图；组件不存在时返回 `null`。 */
    getComp(location: ArchetypeRow, compId: ComponentId): TypedArray[] | null {
        if (!this.data.valid(location)) return null;
        const columns = this._componentColumns[compId];
        if (columns === undefined) return null;
        const table = this.data.table(this.data.tableIdOf(location))!;
        return this.getTableComponent(table, compId) as TypedArray[];
    }

    /** 将源实体与目标 Archetype 共有的组件字段复制到目标行。 */
    copyCommonTo(source: ArchetypeRow, target: Archetype, targetRow: ArchetypeRow): void {
        const sourceTable = this.data.table(this.data.tableIdOf(source))!;
        const targetTable = target.data.table(target.data.tableIdOf(targetRow))!;
        const sourceRow = this.data.rowIndexOf(source), targetRowIndex = target.data.rowIndexOf(targetRow);
        const types = target.types;
        for (let typeIndex = 0; typeIndex < types.length; typeIndex++) {
            const comp = types[typeIndex];
            const sourceColumns = this._componentColumns[comp.id];
            const targetColumns = target._componentColumns[comp.id];
            if (!sourceColumns || !targetColumns) continue;
            for (let field = 0; field < sourceColumns.length; field++) {
                targetTable.columns[targetColumns[field]][targetRowIndex] = sourceTable.columns[sourceColumns[field]][sourceRow];
            }
        }
    }

    /** 获取一个 Table 中指定组件的列视图；可传入数组以复用结果容器。 */
    getTableComponent(table: Table, compId: ComponentId, target?: TypedArray[]): readonly TypedArray[] | undefined {
        const columns = this._componentColumns[compId];
        if (columns === undefined) return undefined;
        let result = target;
        if (!result) {
            let views = this._tableComponentViews.get(table);
            if (!views) {
                views = [];
                this._tableComponentViews.set(table, views);
            }
            const cached = views[compId];
            if (cached) return cached;
            result = new Array<TypedArray>(columns.length);
            views[compId] = result;
        }
        result.length = columns.length;
        for (let i = 0; i < columns.length; i++) result[i] = table.columns[columns[i]];
        return result;
    }

    /** 释放该 Archetype 持有的全部 Table。 */
    dispose(): void { this.data.dispose(); }
}
