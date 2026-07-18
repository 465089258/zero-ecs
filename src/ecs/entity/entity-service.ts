import { Service, State } from "../../context";
import type { Mut } from "../../schedule/system";
import {
    DataSet,
    dataRowAt,
    dataRowIndex,
    dataRowTableId,
    type DataRow,
} from "../../storage/data-set";
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
import {
    ENTITY_INDEX_MASK,
    ENTITY_VERSION_BITS,
    ENTITY_VERSION_MASK,
} from "./entity-format";

export type { Entity } from "./entity";
/** 实体在 Archetype DataSet 中的位置。 */
export interface EntityLocation { readonly tableId: number; readonly row: number }

const NONE = 0xFFFFFFFF;

const enum EntityColumn { Version, Archetype, Table, Row }

/** Entity 句柄、位置与槽位分配状态。 */
export class EntityState extends State {
    readonly slots: DataSet | undefined;
    readonly slotRows: DataRow[] = [];
    readonly freeIndices: number[] = [];
    readonly counter: number = 0;
}

/** 管理实体句柄、版本与 Archetype 存储位置。 */
export class EntityService extends Service {
    @Service.inject(ArchetypeService) private readonly _archetypes!: ArchetypeService;
    @Service.inject(EcsMemoryService) private readonly _memory!: EcsMemoryService;
    @Service.inject(ComponentService) private readonly _components!: ComponentService;

    @State.inject(EntityState) private readonly _state!: Mut<EntityState>;

    /** @internal 用于高级诊断的原型只读视图。 */
    get archetypes(): readonly Archetype[] { return this._archetypes.archetypes; }
    /** 当前原型集合版本；新增原型时递增。 */
    get version(): number { return this._archetypes.version; }
    /** @internal 实体槽位的底层存储。 */
    get data(): DataSet { return this.slots; }

    /** 初始化实体槽位存储；每个服务实例只能调用一次。 */
    init(): void {
        if (this._state.slots) throw new Error("EntityService has already been initialized");
        this._state.slots = new DataSet(this._memory.allocator, [Types.U32, Types.U32, Types.U32, Types.U32]);
        const sentinel = this.slots.insert();
        this._state.slotRows.push(sentinel);
        this.writeSlot(0, EntityColumn.Version, 0);
        this.clearLocation(0);
        this._state.counter = 1;
    }

    /** 立即分配并返回一个有效实体句柄，但暂不为其添加组件。 */
    spawn(): Entity {
        const entity = this.allocEntity();
        this.clearLocation(entity >>> ENTITY_VERSION_BITS);
        return entity;
    }

    /** @internal 将实体迁移到指定组件集合，并在目标行上执行回调。 */
    migrate(entity: Entity, mask: Mask, types: ComponentMeta[], callback: (arch: Archetype, row: ArchetypeRow) => void): boolean {
        const index = entity >>> ENTITY_VERSION_BITS;
        if (!this.valid(entity)) return false;
        const newArchIdx = this._archetypes.getIdxOrNewAtMask(mask, types);
        const oldArchIdx = this.readSlot(index, EntityColumn.Archetype);
        const oldLocation = this.readLocation(index);
        const newArch = this._archetypes.getAtIdx(newArchIdx)!;
        if (oldArchIdx !== newArchIdx) {
            const newLocation = newArch.insert(entity);
            if (oldArchIdx !== NONE && oldLocation !== null) {
                const oldArch = this._archetypes.getAtIdx(oldArchIdx)!;
                oldArch.copyCommonTo(oldLocation, newArch, newLocation);
                const moved = oldArch.remove(oldLocation);
                if (moved !== undefined) this.setLocation(moved, oldArchIdx, oldLocation);
            }
            this.setLocation(entity, newArchIdx, newLocation);
            callback(newArch, newLocation);
        } else if (oldLocation !== null) callback(newArch, oldLocation);
        return true;
    }

    /** 销毁实体并回收句柄槽位；实体无效时返回 `false`。 */
    despawn(entity: Entity): boolean {
        if (!this.valid(entity)) return false;
        const index = entity >>> ENTITY_VERSION_BITS;
        const archId = this.readSlot(index, EntityColumn.Archetype);
        const location = this.readLocation(index);
        if (archId === NONE || location === null) {
            this.freeEntity(index, entity & ENTITY_VERSION_MASK);
            return true;
        }
        const arch = this._archetypes.getAtIdx(archId);
        if (!arch || !arch.data.valid(location)) return false;
        const moved = arch.remove(location);
        if (moved !== undefined) this.setLocation(moved, archId, location);
        // 必须先完成存储变更再回收句柄，避免 Query 暂时读到已失效实体。
        this.freeEntity(index, entity & ENTITY_VERSION_MASK);
        return true;
    }

    /** 读取实体组件的单个字段；实体、组件或字段不存在时返回 `null`。 */
    get<T extends object, Field extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: Field,
    ): number | null {
        const component = this._components.getMeta(type);
        if (!component) return null;
        const archetype = this.locateArchetype(entity);
        if (!archetype) return null;
        const location = this.readLocation(entity >>> ENTITY_VERSION_BITS);
        return location === null ? null : archetype.getField(location, component.id, field);
    }

    /** 判断有效实体当前是否包含指定组件。 */
    has<T extends object>(entity: Entity, type: ComponentType<T>): boolean {
        const component = this._components.getMeta(type);
        if (!component) return false;
        const archetype = this.locateArchetype(entity);
        return archetype !== undefined && archetype.mask.has(component.mask);
    }

    /**
     * 返回实体所在 Table 的组件列视图；组件不存在时返回 `null`。
     *
     * 该视图覆盖整个 Table，应结合 {@link getCompLocation} 返回的 `row` 访问当前实体。
     */
    view<T extends object>(entity: Entity, type: ComponentType<T>): ComponentColumns<T> | null {
        const component = this._components.getMeta(type);
        if (!component) return null;
        const archetype = this.locateArchetype(entity);
        if (!archetype) return null;
        const location = this.readLocation(entity >>> ENTITY_VERSION_BITS);
        return location === null ? null : archetype.getComp(location, component.id) as ComponentColumns<T> | null;
    }

    /** 返回实体当前包含的组件类型；实体尚无 Archetype 或无效时返回 `null`。 */
    getTypes(entity: Entity): readonly ComponentType[] | null {
        const types = this.locateArchetype(entity)?.types;
        if (!types) return null;
        return types.map(component => component.type);
    }

    /** 判断实体句柄的索引与版本是否仍然有效。 */
    valid(entity: Entity): boolean {
        const index = entity >>> ENTITY_VERSION_BITS;
        const version = entity & ENTITY_VERSION_MASK;
        return version !== 0 && index > 0 && index < this._state.counter && this.readSlot(index, EntityColumn.Version) === version;
    }

    /** @internal 获取实体句柄中的原始索引。 */
    getRawIndex(entity: Entity): number { return entity >>> ENTITY_VERSION_BITS; }

    /** @internal 获取实体当前的原型索引；无效或尚未进入原型时返回 `-1`。 */
    getArchIdx(entity: Entity): number {
        if (!this.valid(entity)) return -1;
        const archId = this.readSlot(entity >>> ENTITY_VERSION_BITS, EntityColumn.Archetype);
        return archId === NONE ? -1 : archId;
    }

    /** 获取实体在 Archetype DataSet 中的位置；不存在时返回 `null`。 */
    getCompLocation(entity: Entity): EntityLocation | null {
        if (!this.valid(entity)) return null;
        const location = this.readLocation(entity >>> ENTITY_VERSION_BITS);
        return location === null ? null : { tableId: dataRowTableId(location), row: dataRowIndex(location) };
    }

    /** @internal 在不创建组件列数组的情况下校验字段直写。 */
    canSetComponentFieldById(entity: Entity, componentId: ComponentId, field: number): boolean {
        const component = this._components.getById(componentId);
        if (!component || field < 0 || field >= component.layout.length) return false;
        if (!this.valid(entity)) return false;
        const index = entity >>> ENTITY_VERSION_BITS;
        const archetypeId = this.readSlot(index, EntityColumn.Archetype);
        if (archetypeId === NONE) return false;
        const archetype = this._archetypes.getAtIdx(archetypeId);
        return archetype !== undefined && archetype.mask.has(component.mask);
    }

    /** @internal 在不分配组件列数组的情况下写入单个字段。 */
    setComponentFieldById(entity: Entity, componentId: ComponentId, field: number, value: number): boolean {
        const component = this._components.getById(componentId);
        if (!component || field < 0 || field >= component.layout.length) return false;
        if (!this.valid(entity)) return false;
        const index = entity >>> ENTITY_VERSION_BITS;
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

    private locateArchetype(entity: Entity): Archetype | undefined {
        if (!this.valid(entity)) return undefined;
        const index = entity >>> ENTITY_VERSION_BITS;
        const archId = this.readSlot(index, EntityColumn.Archetype);
        return archId === NONE ? undefined : this._archetypes.getAtIdx(archId);
    }

    private allocEntity(): Entity {
        let index: number;
        if (this._state.freeIndices.length > 0) index = this._state.freeIndices.pop()!;
        else {
            if (this._state.counter > ENTITY_INDEX_MASK) throw new RangeError(`Entity capacity exceeded: ${ENTITY_INDEX_MASK}`);
            index = this._state.counter++;
            const row = this.slots.insert();
            this._state.slotRows.push(row);
            this.writeSlot(index, EntityColumn.Version, 1);
        }
        let version = this.readSlot(index, EntityColumn.Version) & ENTITY_VERSION_MASK;
        if (version === 0) { version = 1; this.writeSlot(index, EntityColumn.Version, version); }
        return (((index << ENTITY_VERSION_BITS) | version) >>> 0) as Entity;
    }

    private freeEntity(index: number, version: number): void {
        if (index === 0 || this.readSlot(index, EntityColumn.Version) !== version) return;
        this.clearLocation(index);
        if (version === ENTITY_VERSION_MASK) {
            // 版本耗尽后永久停用槽位，避免旧句柄再次变为有效。
            this.writeSlot(index, EntityColumn.Version, 0);
            return;
        }
        this.writeSlot(index, EntityColumn.Version, version + 1);
        this._state.freeIndices.push(index);
    }

    private setLocation(entity: Entity, archId: number, location: ArchetypeRow): void {
        const index = entity >>> ENTITY_VERSION_BITS;
        this.writeSlot(index, EntityColumn.Archetype, archId);
        this.writeSlot(index, EntityColumn.Table, dataRowTableId(location));
        this.writeSlot(index, EntityColumn.Row, dataRowIndex(location));
    }

    private clearLocation(index: number): void {
        this.writeSlot(index, EntityColumn.Archetype, NONE);
        this.writeSlot(index, EntityColumn.Table, NONE);
        this.writeSlot(index, EntityColumn.Row, NONE);
    }

    private readLocation(index: number): ArchetypeRow | null {
        const tableId = this.readSlot(index, EntityColumn.Table);
        const row = this.readSlot(index, EntityColumn.Row);
        return tableId === NONE || row === NONE ? null : dataRowAt(tableId, row);
    }

    /** 释放实体槽位存储并清空所有句柄状态。 */
    dispose(): void {
        this._state.slots?.dispose();
        this._state.slots = undefined;
        this._state.slotRows.length = 0;
        this._state.freeIndices.length = 0;
        this._state.counter = 0;
    }

    private get slots(): DataSet {
        if (!this._state.slots) throw new Error("EntityService has not been initialized");
        return this._state.slots;
    }

    private readSlot(index: number, column: EntityColumn): number { return this.slots.get(this._state.slotRows[index], column); }
    private writeSlot(index: number, column: EntityColumn, value: number): void { this.slots.set(this._state.slotRows[index], column, value); }
}
