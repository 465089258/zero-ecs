import {
    DataSet,
    type DataRow,
} from "./storage/data-set";
import type { IAllocator } from "./storage/memory";
import { Types } from "./storage/typed-array";
import { Archetype, type ArchetypeRow } from "./archetype/archetype";
import { ArchetypeStore } from "./archetype/archetype-store";
import {
    type ComponentColumns,
    type ComponentDefinition,
    type ComponentFields,
    type ComponentId,
    type ComponentMeta,
    type ComponentType,
} from "./component/component";
import { ComponentRegistry } from "./component/component-registry";
import { Mask } from "./component/mask";
import type { Entity } from "./entity/entity";
import {
    ENTITY_INDEX_MASK,
    ENTITY_VERSION_BITS,
    ENTITY_VERSION_MASK,
} from "./entity/entity-format";
import { Query } from "./query/query";
import type { QueryType } from "./query/query-type";
import {
    applyEntityCommand as applyWorldEntityCommand,
    createEntityCommand as createWorldEntityCommand,
    type EntityCommand,
} from "./command/entity-command";

/** 实体在 Archetype DataSet 中的位置。 */
export interface EntityLocation { readonly tableId: number; readonly row: number }

/** System 与普通运行时代码使用的非结构 World 视图。 */
export interface WorldView {
    valid(entity: Entity): boolean;
    get<T extends object, Field extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: Field,
    ): number | null;
    has<T extends object>(entity: Entity, type: ComponentType<T>): boolean;
}

/** 宿主在已确认安全的时点使用的即时结构写能力。 */
export interface StructureWriter {
    reserveEntity(): Entity;
    despawn(entity: Entity): boolean;
    createEntityCommand(entity: Entity): EntityCommand;
    applyEntityCommand(command: EntityCommand): boolean;
}

/** advanced 子路径提供的显式不安全结构能力。 */
export interface UnsafeStructureWriter extends StructureWriter {}

const NONE = 0xFFFFFFFF;
const enum EntityColumn { Version, Archetype, Table, Row }

/**
 * 独立的实体数据内核。
 *
 * World 直接持有组件注册表、Archetype、实体槽位与 Query 数据源，不依赖 Game、
 * Service、State 或依赖注入。Allocator 必须由构造方提供并保留所有权；World 只借用
 * 它，在释放时归还自身申请的 Buffer。
 */
export class World implements WorldView, StructureWriter {
    private declare readonly __worldBrand: void;
    private readonly _allocator: IAllocator;
    private readonly _components = new ComponentRegistry();
    private readonly _archetypes: ArchetypeStore;
    private readonly _slots: DataSet;
    private readonly _slotRows: DataRow[] = [];
    private readonly _freeIndices: number[] = [];
    private _counter = 1;
    private _disposed = false;

    constructor(allocator: IAllocator) {
        if (!allocator) throw new TypeError("World requires an IAllocator");
        this._allocator = allocator;
        this._archetypes = new ArchetypeStore(this._allocator);
        this._slots = new DataSet(this._allocator, [Types.U32, Types.U32, Types.U32, Types.U32]);
        const sentinel = this._slots.insert();
        this._slotRows.push(sentinel);
        this.writeSlot(0, EntityColumn.Version, 0);
        this.clearLocation(0);
    }

    /** 在当前 World 中定义组件；重复定义返回同一个定义。 */
    defineComponent<T extends object>(type: ComponentType<T>): ComponentDefinition<T> {
        return this._components.def(type);
    }

    /** 查询已定义组件；该操作不会触发注册。 */
    component<T extends object>(type: ComponentType<T>): ComponentDefinition<T> | undefined {
        return this._components.get(type);
    }

    /** 创建直接绑定当前 World 内核的运行时 Query。 */
    query<Components extends readonly (object | undefined)[]>(type: QueryType<Components>): Query<Components> {
        return new Query(type, this._components, this._archetypes);
    }

    /** 立即预留一个有效实体句柄，但暂不进入 Archetype。 */
    reserveEntity(): Entity {
        const entity = this.allocEntity();
        this.clearLocation(entity >>> ENTITY_VERSION_BITS);
        return entity;
    }

    /** 为有效实体创建一个全新的 World-local 局部事务。 */
    createEntityCommand(entity: Entity): EntityCommand {
        return createWorldEntityCommand(this, entity);
    }

    /** 原子应用一个由当前 World 创建的实体事务。 */
    applyEntityCommand(command: EntityCommand): boolean {
        return applyWorldEntityCommand(this, command);
    }

    /** 销毁实体并回收句柄槽位；实体无效时返回 false。 */
    despawn(entity: Entity): boolean {
        if (!this.valid(entity)) return false;
        const index = entity >>> ENTITY_VERSION_BITS;
        const archetypeId = this.readSlot(index, EntityColumn.Archetype);
        if (archetypeId === NONE) {
            this.freeEntity(index, entity & ENTITY_VERSION_MASK);
            return true;
        }
        const archetype = this._archetypes.getAtIdx(archetypeId);
        if (!archetype) return false;
        const location = this.readLocation(index, archetype);
        if (location === null) {
            this.freeEntity(index, entity & ENTITY_VERSION_MASK);
            return true;
        }
        if (!archetype.data.valid(location)) return false;
        const moved = archetype.remove(location);
        if (moved !== undefined) this.setLocation(moved, archetypeId, location);
        this.freeEntity(index, entity & ENTITY_VERSION_MASK);
        return true;
    }

    /** 读取实体组件的单个字段；实体、组件或字段不存在时返回 null。 */
    get<T extends object, Field extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: Field,
    ): number | null {
        const component = this._components.getMeta(type);
        if (!component) return null;
        const archetype = this.locateArchetype(entity);
        if (!archetype) return null;
        const location = this.readLocation(entity >>> ENTITY_VERSION_BITS, archetype);
        return location === null ? null : archetype.getField(location, component.id, field);
    }

    /** 判断有效实体当前是否包含指定组件。 */
    has<T extends object>(entity: Entity, type: ComponentType<T>): boolean {
        const component = this._components.getMeta(type);
        if (!component) return false;
        const archetype = this.locateArchetype(entity);
        return archetype !== undefined && archetype.mask.has(component.mask);
    }

    /** 返回实体所在 Table 的组件列视图；属于可能失效的 advanced 数据视图。 */
    view<T extends object>(entity: Entity, type: ComponentType<T>): ComponentColumns<T> | null {
        const component = this._components.getMeta(type);
        if (!component) return null;
        const archetype = this.locateArchetype(entity);
        if (!archetype) return null;
        const location = this.readLocation(entity >>> ENTITY_VERSION_BITS, archetype);
        return location === null ? null : archetype.getComp(location, component.id) as ComponentColumns<T> | null;
    }

    /** 返回实体当前组件类型；诊断便利接口会分配新数组。 */
    getTypes(entity: Entity): readonly ComponentType[] | null {
        const types = this.locateArchetype(entity)?.types;
        return types ? types.map(component => component.type) : null;
    }

    /** 判断实体句柄的索引与版本是否仍然有效。 */
    valid(entity: Entity): boolean {
        const index = entity >>> ENTITY_VERSION_BITS;
        const version = entity & ENTITY_VERSION_MASK;
        return version !== 0 && index > 0 && index < this._counter &&
            this.readSlot(index, EntityColumn.Version) === version;
    }

    /** 获取实体存储位置；诊断便利接口会分配结果对象。 */
    getCompLocation(entity: Entity): EntityLocation | null {
        if (!this.valid(entity)) return null;
        const index = entity >>> ENTITY_VERSION_BITS;
        const tableId = this.readSlot(index, EntityColumn.Table);
        const row = this.readSlot(index, EntityColumn.Row);
        return tableId === NONE || row === NONE ? null : { tableId, row };
    }

    /** @internal 当前 World 使用的原始分配器。 */
    get allocator(): IAllocator { return this._allocator; }
    /** @internal World 是否已经完成内核释放。 */
    get disposed(): boolean { return this._disposed; }
    /** @internal 当前全部 Archetype 的诊断视图。 */
    get archetypes(): readonly Archetype[] { return this._archetypes.archetypes; }
    /** @internal Archetype 集合版本。 */
    get version(): number { return this._archetypes.version; }
    /** @internal 实体槽位的底层存储。 */
    get data(): DataSet { return this._slots; }

    /** @internal 定义组件并取得存储元数据。 */
    defineComponentMeta<T extends object>(type: ComponentType<T>): ComponentMeta<T> {
        return this._components.defMeta(type);
    }

    /** @internal 查询组件存储元数据。 */
    getComponentMeta<T extends object>(type: ComponentType<T>): ComponentMeta<T> | undefined {
        return this._components.getMeta(type);
    }

    /** @internal 按组件编号查询存储元数据。 */
    getComponentMetaById(id: ComponentId): ComponentMeta | undefined {
        return this._components.getById(id);
    }

    /** @internal 按内部索引取得 Archetype。 */
    getArchetypeAt(idx: number): Archetype | undefined { return this._archetypes.getAtIdx(idx); }

    /** @internal 按掩码取得或创建 Archetype。 */
    getOrCreateArchetype(mask: Mask, types: readonly ComponentMeta[]): Archetype {
        return this._archetypes.getOrNewAtMask(mask, types);
    }

    /** @internal 获取实体句柄中的原始索引。 */
    getRawIndex(entity: Entity): number { return entity >>> ENTITY_VERSION_BITS; }

    /** @internal 获取实体当前 Archetype 索引。 */
    getArchIdx(entity: Entity): number {
        if (!this.valid(entity)) return -1;
        const archetypeId = this.readSlot(entity >>> ENTITY_VERSION_BITS, EntityColumn.Archetype);
        return archetypeId === NONE ? -1 : archetypeId;
    }

    /** @internal 将实体迁移到指定组件集合。 */
    migrate(
        entity: Entity,
        mask: Mask,
        types: readonly ComponentMeta[],
        callback: (archetype: Archetype, row: ArchetypeRow) => void,
    ): boolean {
        const index = entity >>> ENTITY_VERSION_BITS;
        if (!this.valid(entity)) return false;
        const newArchetypeIdx = this._archetypes.getIdxOrNewAtMask(mask, types);
        const oldArchetypeIdx = this.readSlot(index, EntityColumn.Archetype);
        const oldArchetype = oldArchetypeIdx === NONE
            ? undefined
            : this._archetypes.getAtIdx(oldArchetypeIdx);
        const oldLocation = oldArchetype ? this.readLocation(index, oldArchetype) : null;
        const newArchetype = this._archetypes.getAtIdx(newArchetypeIdx)!;
        if (oldArchetypeIdx !== newArchetypeIdx) {
            const newLocation = newArchetype.insert(entity);
            if (oldArchetypeIdx !== NONE && oldArchetype && oldLocation !== null) {
                oldArchetype.copyCommonTo(oldLocation, newArchetype, newLocation);
                const moved = oldArchetype.remove(oldLocation);
                if (moved !== undefined) this.setLocation(moved, oldArchetypeIdx, oldLocation);
            }
            this.setLocation(entity, newArchetypeIdx, newLocation);
            callback(newArchetype, newLocation);
        } else if (oldLocation !== null) callback(newArchetype, oldLocation);
        return true;
    }

    /** @internal 在不创建组件列数组的情况下校验字段直写。 */
    canSetComponentFieldById(entity: Entity, componentId: ComponentId, field: number): boolean {
        const component = this._components.getById(componentId);
        if (!component || field < 0 || field >= component.layout.length || !this.valid(entity)) return false;
        const archetypeId = this.readSlot(entity >>> ENTITY_VERSION_BITS, EntityColumn.Archetype);
        if (archetypeId === NONE) return false;
        const archetype = this._archetypes.getAtIdx(archetypeId);
        return archetype !== undefined && archetype.mask.has(component.mask);
    }

    /** @internal 在不分配组件列数组的情况下写入单个字段。 */
    setComponentFieldById(entity: Entity, componentId: ComponentId, field: number, value: number): boolean {
        const component = this._components.getById(componentId);
        if (!component || field < 0 || field >= component.layout.length || !this.valid(entity)) return false;
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

    /** 释放 World 持有的全部实体数据并归还 Buffer，不清空构造方拥有的 IAllocator。 */
    dispose(): void {
        if (this._disposed) return;
        this._disposed = true;
        let firstError: unknown;
        try { this._slots.dispose(); }
        catch (error) { firstError ??= error; }
        try { this._archetypes.dispose(); }
        catch (error) { firstError ??= error; }
        this._slotRows.length = 0;
        this._freeIndices.length = 0;
        this._counter = 0;
        if (firstError !== undefined) throw firstError;
    }

    private locateArchetype(entity: Entity): Archetype | undefined {
        if (!this.valid(entity)) return undefined;
        const archetypeId = this.readSlot(entity >>> ENTITY_VERSION_BITS, EntityColumn.Archetype);
        return archetypeId === NONE ? undefined : this._archetypes.getAtIdx(archetypeId);
    }

    private allocEntity(): Entity {
        let index: number;
        if (this._freeIndices.length > 0) index = this._freeIndices.pop()!;
        else {
            if (this._counter > ENTITY_INDEX_MASK) {
                throw new RangeError(`Entity capacity exceeded: ${ENTITY_INDEX_MASK}`);
            }
            index = this._counter++;
            const row = this._slots.insert();
            this._slotRows.push(row);
            this.writeSlot(index, EntityColumn.Version, 1);
        }
        let version = this.readSlot(index, EntityColumn.Version) & ENTITY_VERSION_MASK;
        if (version === 0) {
            version = 1;
            this.writeSlot(index, EntityColumn.Version, version);
        }
        return (((index << ENTITY_VERSION_BITS) | version) >>> 0) as Entity;
    }

    private freeEntity(index: number, version: number): void {
        if (index === 0 || this.readSlot(index, EntityColumn.Version) !== version) return;
        this.clearLocation(index);
        if (version === ENTITY_VERSION_MASK) {
            this.writeSlot(index, EntityColumn.Version, 0);
            return;
        }
        this.writeSlot(index, EntityColumn.Version, version + 1);
        this._freeIndices.push(index);
    }

    private setLocation(entity: Entity, archetypeId: number, location: ArchetypeRow): void {
        const index = entity >>> ENTITY_VERSION_BITS;
        const archetype = this._archetypes.getAtIdx(archetypeId);
        if (!archetype) throw new RangeError(`Invalid Archetype index: ${archetypeId}`);
        this.writeSlot(index, EntityColumn.Archetype, archetypeId);
        this.writeSlot(index, EntityColumn.Table, archetype.data.tableIdOf(location));
        this.writeSlot(index, EntityColumn.Row, archetype.data.rowIndexOf(location));
    }

    private clearLocation(index: number): void {
        this.writeSlot(index, EntityColumn.Archetype, NONE);
        this.writeSlot(index, EntityColumn.Table, NONE);
        this.writeSlot(index, EntityColumn.Row, NONE);
    }

    private readLocation(index: number, archetype: Archetype): ArchetypeRow | null {
        const tableId = this.readSlot(index, EntityColumn.Table);
        const row = this.readSlot(index, EntityColumn.Row);
        return tableId === NONE || row === NONE ? null : archetype.data.locationAt(tableId, row);
    }

    private readSlot(index: number, column: EntityColumn): number {
        return this._slots.get(this._slotRows[index], column);
    }

    private writeSlot(index: number, column: EntityColumn, value: number): void {
        this._slots.set(this._slotRows[index], column, value);
    }
}

/** 取得显式不安全结构入口；运行时对象就是 World。 */
export function unsafeStructureWriter(world: World): UnsafeStructureWriter { return world; }

/** advanced 诊断入口；返回值会随结构变更失效。 */
export function archetypesOfWorld(world: World): readonly Archetype[] { return world.archetypes; }

/** game-bridge 冷路径入口：取得构造 World 时借用的分配器。 */
export function allocatorOfWorld(world: World): IAllocator { return world.allocator; }

/** game-bridge 冷路径入口：判断 World 是否已经释放。 */
export function isWorldDisposed(world: World): boolean { return world.disposed; }
