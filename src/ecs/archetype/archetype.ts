import {
    DataSet,
    dataRowIndex,
    dataRowTableId,
    RemoveResult,
    type DataRow,
    type Table,
} from "../../storage/data-set";
import type { IChunkAllocator } from "../../storage/memory";
import { type TypedArray, Types } from "../../storage/typed-array";
import { type ComponentId, type ComponentMeta } from "../component/component";
import { Mask } from "../component/mask";
import type { Entity } from "../entity/entity";

export const ENTITY_COLUMN = 0;

/** A stable location of a row inside an archetype DataSet. */
export type ArchetypeRow = DataRow;

/** Component fields for one concrete 16 KiB table. */
export class Archetype {
    readonly mask: Mask;
    readonly name: string;
    readonly data: DataSet;
    private readonly _types: ComponentMeta[];
    private readonly _componentColumns: Array<readonly number[] | undefined>;
    private readonly _tableComponentViews = new WeakMap<Table, Array<readonly TypedArray[] | undefined>>();

    get count(): number { return this.data.count; }
    get types(): ReadonlyArray<ComponentMeta> { return this._types; }
    get tables(): readonly Table[] { return this.data.tables; }

    constructor(mask: Mask, types: readonly ComponentMeta[] | undefined, allocator: IChunkAllocator) {
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

    insert(entity: Entity): ArchetypeRow {
        const location = this.data.insert();
        this.data.set(location, ENTITY_COLUMN, entity);
        return location;
    }

    remove(location: ArchetypeRow): Entity | undefined {
        if (!this.data.valid(location)) return undefined;
        const lastTable = this.data.tables[this.data.tables.length - 1];
        const lastRow = lastTable.count - 1;
        const moved = lastTable.columns[ENTITY_COLUMN][lastRow] as Entity;
        const result = this.data.remove(location);
        return result === RemoveResult.Moved ? moved : undefined;
    }

    getEntity(location: ArchetypeRow): Entity | undefined {
        return this.data.valid(location) ? this.data.get(location, ENTITY_COLUMN) as Entity : undefined;
    }

    getField(location: ArchetypeRow, compId: ComponentId, fieldId: number): number | null {
        const column = this._componentColumns[compId]?.[fieldId];
        if (column === undefined || !this.data.valid(location)) return null;
        return this.data.get(location, column);
    }

    setField(location: ArchetypeRow, compId: ComponentId, fieldId: number, value: number): boolean {
        const column = this._componentColumns[compId]?.[fieldId];
        if (column === undefined || !this.data.valid(location)) return false;
        this.data.set(location, column, value);
        return true;
    }

    setFieldAt(tableId: number, row: number, compId: ComponentId, fieldId: number, value: number): boolean {
        const column = this._componentColumns[compId]?.[fieldId];
        if (column === undefined || !this.data.validAt(tableId, row)) return false;
        this.data.setAt(tableId, row, column, value);
        return true;
    }

    getComp(location: ArchetypeRow, compId: ComponentId): TypedArray[] | null {
        if (!this.data.valid(location)) return null;
        const columns = this._componentColumns[compId];
        if (columns === undefined) return null;
        const table = this.data.table(dataRowTableId(location))!;
        return this.getTableComponent(table, compId) as TypedArray[];
    }

    copyCommonTo(source: ArchetypeRow, target: Archetype, targetRow: ArchetypeRow): void {
        const sourceTable = this.data.table(dataRowTableId(source))!;
        const targetTable = target.data.table(dataRowTableId(targetRow))!;
        const sourceRow = dataRowIndex(source), targetRowIndex = dataRowIndex(targetRow);
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

    dispose(): void { this.data.dispose(); }
}
