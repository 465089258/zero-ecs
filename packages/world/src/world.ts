import type { IAllocator } from "./storage/memory";
import { Archetype, type ArchetypeRow } from "./archetype/archetype";
import { ArchetypeStore } from "./archetype/archetype-store";
import {
    type ComponentColumns,
    type ComponentDefinition,
    type ComponentFieldValue,
    type ComponentFields,
    type ComponentId,
    type ComponentMeta,
    type ComponentType,
} from "./component/component";
import { ComponentRegistry } from "./component/component-registry";
import { Mask } from "./component/mask";
import type { Entity } from "./entity/entity";
import { EntityRef } from "./entity/entity-ref";
import { ENTITY_VERSION_BITS } from "./entity/entity-format";
import { EntitySlots, NONE_SLOT_VALUE } from "./entity/entity-slots";
import { Query } from "./query/query";
import type { QueryType } from "./query/query-type";
import type { QueryProjection } from "./query/query-data";
import {
    applyEntityCommand as applyWorldEntityCommand,
    createEntityCommand as createWorldEntityCommand,
    type EntityCommand,
} from "./command/entity-command";

/** 实体在 Archetype Chunk 中的位置。 */
export interface EntityLocation { readonly chunkIdx: number; readonly row: number }

/** System 与普通运行时代码使用的非结构 World 视图。 */
export interface WorldView {
    /** 创建绑定实体的低频只读便利视图；每次调用都会分配一个 EntityRef。 */
    ref(entity: Entity): EntityRef;
    valid(entity: Entity): boolean;
    get<T extends object, Field extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: Field,
    ): ComponentFieldValue<T, Field> | null;
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
    private readonly _slots: EntitySlots;
    private _disposed = false;

    constructor(allocator: IAllocator) {
        if (!allocator) throw new TypeError("World requires an IAllocator");
        this._allocator = allocator;
        this._archetypes = new ArchetypeStore(this._allocator);
        this._slots = new EntitySlots(this._allocator);
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

    /** 创建绑定实体的低频只读便利视图；不缓存任何物理存储位置。 */
    ref(entity: Entity): EntityRef { return new EntityRef(this, entity); }

    /** 立即预留一个有效实体句柄，但暂不进入 Archetype。 */
    reserveEntity(): Entity { return this._slots.reserve(); }

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
        const archetypeId = this._slots.archetypeIdxAt(index);
        if (archetypeId === NONE_SLOT_VALUE) return this._slots.release(entity);
        const archetype = this._archetypes.getAtIdx(archetypeId);
        if (!archetype) return false;
        const location = this.readLocation(index, archetype);
        if (location === null) return this._slots.release(entity);
        if (!archetype.valid(location)) return false;
        const moved = archetype.remove(location);
        if (moved !== undefined) this.setLocation(moved, archetypeId, location);
        return this._slots.release(entity);
    }

    /** 读取实体组件的单个字段；实体、组件或字段不存在时返回 null。 */
    get<T extends object, Field extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: Field,
    ): ComponentFieldValue<T, Field> | null {
        const component = this._components.getMeta(type);
        if (!component) return null;
        const archetype = this.locateArchetype(entity);
        if (!archetype) return null;
        const location = this.readLocation(entity >>> ENTITY_VERSION_BITS, archetype);
        return (location === null ? null : archetype.getField(location, component.id, field)) as
            ComponentFieldValue<T, Field> | null;
    }

    /** 判断有效实体当前是否包含指定组件。 */
    has<T extends object>(entity: Entity, type: ComponentType<T>): boolean {
        const component = this._components.getMeta(type);
        if (!component) return false;
        const archetype = this.locateArchetype(entity);
        return archetype !== undefined && archetype.mask.has(component.mask);
    }

    /** 返回实体所在 Chunk 的组件列视图；属于可能失效的 advanced 数据视图。 */
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
    valid(entity: Entity): boolean { return this._slots.valid(entity); }

    /** 获取实体存储位置；诊断便利接口会分配结果对象。 */
    getCompLocation(entity: Entity): EntityLocation | null {
        if (!this.valid(entity)) return null;
        const index = entity >>> ENTITY_VERSION_BITS;
        const chunkIdx = this._slots.chunkIdxAt(index);
        const row = this._slots.rowAt(index);
        return chunkIdx === NONE_SLOT_VALUE || row === NONE_SLOT_VALUE ? null : { chunkIdx, row };
    }

    /** @internal 当前 World 使用的原始分配器。 */
    get allocator(): IAllocator { return this._allocator; }
    /** @internal World 是否已经完成内核释放。 */
    get disposed(): boolean { return this._disposed; }
    /** @internal 当前全部 Archetype 的诊断视图。 */
    get archetypes(): readonly Archetype[] { return this._archetypes.archetypes; }
    /** @internal Archetype 集合版本。 */
    get version(): number { return this._archetypes.version; }
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

    /** @internal 为组合层注册只读 Query 投影的隐藏存储组件。 */
    registerQueryProjection<T extends object>(
        projection: QueryProjection<T>,
        storage: ComponentType<T>,
    ): void {
        this._components.registerProjection(projection, storage);
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
        const archetypeId = this._slots.archetypeIdxAt(entity >>> ENTITY_VERSION_BITS);
        return archetypeId === NONE_SLOT_VALUE ? -1 : archetypeId;
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
        const oldArchetypeIdx = this._slots.archetypeIdxAt(index);
        const oldArchetype = oldArchetypeIdx === NONE_SLOT_VALUE
            ? undefined
            : this._archetypes.getAtIdx(oldArchetypeIdx);
        const oldLocation = oldArchetype ? this.readLocation(index, oldArchetype) : null;
        const newArchetype = this._archetypes.getAtIdx(newArchetypeIdx)!;
        if (oldArchetypeIdx !== newArchetypeIdx) {
            const newLocation = newArchetype.insert(entity);
            if (oldArchetypeIdx !== NONE_SLOT_VALUE && oldArchetype && oldLocation !== null) {
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
        const archetypeId = this._slots.archetypeIdxAt(entity >>> ENTITY_VERSION_BITS);
        if (archetypeId === NONE_SLOT_VALUE) return false;
        const archetype = this._archetypes.getAtIdx(archetypeId);
        return archetype !== undefined && archetype.mask.has(component.mask);
    }

    /** @internal 在不分配组件列数组的情况下写入单个字段。 */
    setComponentFieldById(entity: Entity, componentId: ComponentId, field: number, value: number): boolean {
        const component = this._components.getById(componentId);
        if (!component || field < 0 || field >= component.layout.length || !this.valid(entity)) return false;
        const index = entity >>> ENTITY_VERSION_BITS;
        const archetypeId = this._slots.archetypeIdxAt(index);
        if (archetypeId === NONE_SLOT_VALUE) return false;
        const archetype = this._archetypes.getAtIdx(archetypeId);
        if (!archetype || !archetype.mask.has(component.mask)) return false;
        return archetype.setFieldAt(
            this._slots.chunkIdxAt(index),
            this._slots.rowAt(index),
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
        if (firstError !== undefined) throw firstError;
    }

    private locateArchetype(entity: Entity): Archetype | undefined {
        if (!this.valid(entity)) return undefined;
        const archetypeId = this._slots.archetypeIdxAt(entity >>> ENTITY_VERSION_BITS);
        return archetypeId === NONE_SLOT_VALUE ? undefined : this._archetypes.getAtIdx(archetypeId);
    }

    private setLocation(entity: Entity, archetypeId: number, location: ArchetypeRow): void {
        const index = entity >>> ENTITY_VERSION_BITS;
        const archetype = this._archetypes.getAtIdx(archetypeId);
        if (!archetype) throw new RangeError(`Invalid Archetype index: ${archetypeId}`);
        this._slots.setLocationAt(
            index,
            archetypeId,
            archetype.chunkIdxOf(location),
            archetype.rowIdxOf(location),
        );
    }

    private readLocation(index: number, archetype: Archetype): ArchetypeRow | null {
        const chunkIdx = this._slots.chunkIdxAt(index);
        const row = this._slots.rowAt(index);
        return chunkIdx === NONE_SLOT_VALUE || row === NONE_SLOT_VALUE
            ? null
            : archetype.locationAt(chunkIdx, row);
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

/**
 * game-bridge 冷路径入口：绕过子类 override，确保 World 内核一定完成终结。
 * 该入口不属于普通 World 公共 API。
 */
export function finalizeWorldKernel(world: World): void {
    World.prototype.dispose.call(world);
}
