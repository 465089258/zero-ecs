import { Service } from "../../context/types";
import { DataSet, type DataRow } from "../../storage/data-set";
import { Types } from "../../storage/typed-array";
import { Archetype, type ArchetypeRow } from "../archetype/archetype";
import { ArchetypeService } from "../archetype/archetype-service";
import {
    type ComponentColumns,
    type ComponentFields,
    type ComponentId,
    type ComponentMeta,
    type ComponentType,
} from "../component/component";
import { ComponentService } from "../component/component-registry";
import { Mask } from "../component/mask";
import { EcsMemoryService } from "../memory/ecs-memory-service";
import type { Entity } from "./entity";

export type { Entity } from "./entity";

const INDEX_BITS = 20;
const VERSION_BITS = 12;
const INDEX_MASK = (1 << INDEX_BITS) - 1;
const VERSION_MASK = (1 << VERSION_BITS) - 1;
const NONE = 0xFFFFFFFF;

const enum EntityColumn { Version, Archetype, Table, Row }

/** Stable entity slots backed by DataSet tables. Rows are never removed or moved. */
export class EntityService extends Service {
    @Service.inject(ArchetypeService) private _archetypes!: ArchetypeService;
    @Service.inject(EcsMemoryService) private _memory!: EcsMemoryService;
    @Service.inject(ComponentService) private _components!: ComponentService;

    private _slots: DataSet | undefined;
    private readonly _slotRows: DataRow[] = [];
    private readonly _freeIndices: number[] = [];
    private _counter = 0;

    get archetypes(): readonly Archetype[] { return this._archetypes.archetypes; }
    get version(): number { return this._archetypes.version; }
    get data(): DataSet { return this.slots; }

    init(): void {
        if (this._slots) throw new Error("EntityService has already been initialized");
        this._slots = new DataSet(this._memory.allocator, [Types.U32, Types.U32, Types.U32, Types.U32]);
        const sentinel = this.slots.insert();
        this._slotRows.push(sentinel);
        this.writeSlot(0, EntityColumn.Version, 0);
        this.clearLocation(0);
        this._counter = 1;
    }

    spawn(): Entity {
        const entity = this.allocEntity();
        this.clearLocation(entity >>> VERSION_BITS);
        return entity;
    }

    migrate(entity: Entity, mask: Mask, types: ComponentMeta[], callback: (arch: Archetype, row: ArchetypeRow) => void): boolean {
        const index = entity >>> VERSION_BITS;
        if (!this.valid(entity)) return false;
        const newArchIdx = this._archetypes.getIdxOrNewAtMask(mask, types);
        const oldArchIdx = this.readSlot(index, EntityColumn.Archetype);
        const oldLocation = this.readLocation(index);
        const newArch = this._archetypes.getAtIdx(newArchIdx)!;
        if (oldArchIdx !== newArchIdx) {
            const newLocation = newArch.insert(entity);
            if (oldArchIdx !== NONE && oldLocation) {
                const oldArch = this._archetypes.getAtIdx(oldArchIdx)!;
                oldArch.copyCommonTo(oldLocation, newArch, newLocation);
                const moved = oldArch.remove(oldLocation);
                if (moved !== undefined) this.setLocation(moved, oldArchIdx, oldLocation);
            }
            this.setLocation(entity, newArchIdx, newLocation);
            callback(newArch, newLocation);
        } else if (oldLocation) callback(newArch, oldLocation);
        return true;
    }

    despawn(entity: Entity): boolean {
        if (!this.valid(entity)) return false;
        const index = entity >>> VERSION_BITS;
        const archId = this.readSlot(index, EntityColumn.Archetype);
        const location = this.readLocation(index);
        this.freeEntity(index, entity & VERSION_MASK);
        if (archId === NONE || !location) return true;
        const arch = this._archetypes.getAtIdx(archId);
        const moved = arch?.remove(location);
        if (moved !== undefined) this.setLocation(moved, archId, location);
        return true;
    }

    get<T extends object, Field extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: Field,
    ): number | null {
        const component = this._components.get(type);
        if (!component) return null;
        const located = this.locate(entity);
        return located ? located.arch.getField(located.row, component.id, field) : null;
    }

    has<T extends object>(entity: Entity, type: ComponentType<T>): boolean {
        const component = this._components.get(type);
        if (!component) return false;
        const located = this.locate(entity);
        return located !== null && located.arch.mask.has(component.mask);
    }

    view<T extends object>(entity: Entity, type: ComponentType<T>): ComponentColumns<T> | null {
        const component = this._components.get(type);
        if (!component) return null;
        const located = this.locate(entity);
        return located
            ? located.arch.getComp(located.row, component.id) as ComponentColumns<T> | null
            : null;
    }

    getTypes(entity: Entity): readonly ComponentType[] | null {
        const types = this.locate(entity)?.arch.types;
        if (!types) return null;
        return types.map(component => component.type);
    }

    valid(entity: Entity): boolean {
        const index = entity >>> VERSION_BITS;
        const version = entity & VERSION_MASK;
        return version !== 0 && index > 0 && index < this._counter && this.readSlot(index, EntityColumn.Version) === version;
    }

    getRawIndex(entity: Entity): number { return entity >>> VERSION_BITS; }

    getArchIdx(entity: Entity): number {
        if (!this.valid(entity)) return -1;
        const archId = this.readSlot(entity >>> VERSION_BITS, EntityColumn.Archetype);
        return archId === NONE ? -1 : archId;
    }

    getCompLocation(entity: Entity): ArchetypeRow | null {
        return this.valid(entity) ? this.readLocation(entity >>> VERSION_BITS) : null;
    }

    /** @internal Validates a direct field write without creating a component view. */
    canSetComponentFieldById(entity: Entity, componentId: ComponentId, field: number): boolean {
        const component = this._components.getById(componentId);
        if (!component || field < 0 || field >= component.layout.length) return false;
        if (!this.valid(entity)) return false;
        const index = entity >>> VERSION_BITS;
        const archetypeId = this.readSlot(index, EntityColumn.Archetype);
        if (archetypeId === NONE) return false;
        const archetype = this._archetypes.getAtIdx(archetypeId);
        return archetype !== undefined && archetype.mask.has(component.mask);
    }

    /** @internal Writes one field without allocating a component column array. */
    setComponentFieldById(entity: Entity, componentId: ComponentId, field: number, value: number): boolean {
        const component = this._components.getById(componentId);
        if (!component || field < 0 || field >= component.layout.length) return false;
        if (!this.valid(entity)) return false;
        const index = entity >>> VERSION_BITS;
        const archetypeId = this.readSlot(index, EntityColumn.Archetype);
        if (archetypeId === NONE) return false;
        const archetype = this._archetypes.getAtIdx(archetypeId);
        if (!archetype || !archetype.mask.has(component.mask)) return false;
        return archetype.setFieldAt(
            this.readSlot(index, EntityColumn.Table),
            this.readSlot(index, EntityColumn.Row),
            component.id,
            field,
            value,
        );
    }

    /** @deprecated Use getCompLocation() because rows are scoped to a table. */
    getCompRow(entity: Entity): number { return this.getCompLocation(entity)?.row ?? -1; }

    private locate(entity: Entity): { arch: Archetype; row: ArchetypeRow } | null {
        if (!this.valid(entity)) return null;
        const index = entity >>> VERSION_BITS;
        const archId = this.readSlot(index, EntityColumn.Archetype);
        const row = this.readLocation(index);
        if (archId === NONE || !row) return null;
        const arch = this._archetypes.getAtIdx(archId);
        return arch ? { arch, row } : null;
    }

    private allocEntity(): Entity {
        let index: number;
        if (this._freeIndices.length > 0) index = this._freeIndices.pop()!;
        else {
            if (this._counter > INDEX_MASK) throw new RangeError(`Entity capacity exceeded: ${INDEX_MASK}`);
            index = this._counter++;
            const row = this.slots.insert();
            this._slotRows.push(row);
            this.writeSlot(index, EntityColumn.Version, 1);
        }
        let version = this.readSlot(index, EntityColumn.Version) & VERSION_MASK;
        if (version === 0) { version = 1; this.writeSlot(index, EntityColumn.Version, version); }
        return (((index << VERSION_BITS) | version) >>> 0) as Entity;
    }

    private freeEntity(index: number, version: number): void {
        if (index === 0 || this.readSlot(index, EntityColumn.Version) !== version) return;
        this.clearLocation(index);
        if (version === VERSION_MASK) {
            // Retire the slot instead of allowing an old handle to become valid again.
            this.writeSlot(index, EntityColumn.Version, 0);
            return;
        }
        this.writeSlot(index, EntityColumn.Version, version + 1);
        this._freeIndices.push(index);
    }

    private setLocation(entity: Entity, archId: number, location: ArchetypeRow): void {
        const index = entity >>> VERSION_BITS;
        this.writeSlot(index, EntityColumn.Archetype, archId);
        this.writeSlot(index, EntityColumn.Table, location.tableId);
        this.writeSlot(index, EntityColumn.Row, location.row);
    }

    private clearLocation(index: number): void {
        this.writeSlot(index, EntityColumn.Archetype, NONE);
        this.writeSlot(index, EntityColumn.Table, NONE);
        this.writeSlot(index, EntityColumn.Row, NONE);
    }

    private readLocation(index: number): ArchetypeRow | null {
        const tableId = this.readSlot(index, EntityColumn.Table);
        const row = this.readSlot(index, EntityColumn.Row);
        return tableId === NONE || row === NONE ? null : { tableId, row };
    }

    dispose(): void {
        this._slots?.dispose();
        this._slots = undefined;
        this._slotRows.length = 0;
        this._freeIndices.length = 0;
        this._counter = 0;
    }

    private get slots(): DataSet {
        if (!this._slots) throw new Error("EntityService has not been initialized");
        return this._slots;
    }

    private readSlot(index: number, column: EntityColumn): number { return this.slots.get(this._slotRows[index], column); }
    private writeSlot(index: number, column: EntityColumn, value: number): void { this.slots.set(this._slotRows[index], column, value); }
}
