import type { IAllocator } from "./storage/memory";
import { DataSet, type Table } from "./storage/data-set";
import { Types, U16, U32 } from "./storage/typed-array";
import { Archetype, type ArchetypeRow } from "./archetype/archetype";
import {
    type ComponentColumns,
    type ComponentFieldValue,
    type ComponentFields,
    type ComponentId,
    type ComponentMeta,
    type ComponentType,
} from "./component/component";
import { ComponentRegistry } from "./component/component-registry";
import { Mask } from "./component/mask";
import type { Entity } from "./entity/entity";
import {
    ENTITY_INDEX_BITS,
    ENTITY_INDEX_MASK,
    ENTITY_VERSION_BITS,
    ENTITY_VERSION_MASK,
} from "./entity/entity-format";
import { Query } from "./query/query";
import type { QueryType } from "./query/query-type";
import { Disposable } from "./storage/disposable";

/** 实体在 Archetype Chunk 中的位置。 */
export interface EntityLocation { readonly chunkIdx: number; readonly row: number }

/** 调用者持有并复用的零分配实体物理位置解析结果。 */
export interface EntityAccess {
    archetype: Archetype | null;
    row: ArchetypeRow;
}

const enum SlotColumn {
    VersionState,
    Location,
}


type SlotColumns = readonly [U16, U32];

interface ArchetypeMaskIndex {
    readonly mask: Mask;
    readonly idx: number;
}

const SLOT_ALIVE = 1 << ENTITY_VERSION_BITS;
const SLOT_QUARANTINED = 1 << (ENTITY_VERSION_BITS + 1);
const SLOT_ROW_BITS = ENTITY_INDEX_BITS;
const SLOT_ROW_MASK = ENTITY_INDEX_MASK;
const SLOT_ARCHETYPE_NONE = 0xFFF;
const MAX_ARCHETYPE_INDEX = SLOT_ARCHETYPE_NONE - 1;
const INVALID_LOCATION = -1;

/**
 * 独立的实体数据内核。
 *
 * World 直接持有组件注册表、Archetype、实体槽位与 Query 数据源，不依赖 Game、
 * Service、State 或依赖注入。Allocator 必须由构造方提供并保留所有权；World 只借用
 * 它，在释放时归还自身申请的 Buffer。
 */
export class World extends Disposable {
    private declare readonly __worldBrand: void;
    private readonly _allocator: IAllocator;
    private readonly _components = new ComponentRegistry();

    private readonly _slotData: DataSet<SlotColumns>;
    private readonly _slotTables: Table<SlotColumns>[];
    private readonly _slotCapacity: number;
    private _entityCount = 0;
    private _freeEntityHead = 0;
    private _quarantinedEntityHead = 0;

    private readonly _archetypes: Archetype[] = [];
    private readonly _archetypeMaskIndexes: ArchetypeMaskIndex[] = [];
    private _version = 0;

    constructor(allocator: IAllocator) {
        super();
        if (!allocator) throw new TypeError("World requires an IAllocator");
        this._allocator = allocator;
        this._slotData = new DataSet(
            allocator,
            [Types.U16, Types.U32] as const,
        );
        this._slotTables = this._slotData.tables;
        this._slotCapacity = this._slotData.layout.capacity;
        // Entity index 0 永远无效，同时确保 World 构造完成后 Slot Buffer 已经可用。
        this.appendEntitySlot();
    }

    /** 在当前 World 中使用并注册组件；重复调用返回同一个定义。 */
    @Disposable.guard
    component<T extends object>(type: ComponentType<T>): ComponentMeta<T> {
        return this._components.defMeta(type);
    }

    /** 创建直接绑定当前 World 内核的运行时 Query。 */
    @Disposable.guard
    query<Components extends readonly (object | undefined)[]>(type: QueryType<Components>): Query<Components> {
        return new Query(type, this._components, this);
    }

    /** 创建有效实体身份；第一次迁移前不属于任何 Archetype。 */
    @Disposable.guard
    spawn(): Entity {
        let index: number;
        let version: number;
        if (this._freeEntityHead !== 0) {
            index = this._freeEntityHead;
            const tableIdx = Math.floor(index / this._slotCapacity);
            const row = index - tableIdx * this._slotCapacity;
            const columns = this._slotTables[tableIdx].columns;
            this._freeEntityHead = columns[SlotColumn.Location][row];
            version = columns[SlotColumn.VersionState][row] & ENTITY_VERSION_MASK;
            columns[SlotColumn.VersionState][row] = SLOT_ALIVE | version;
            columns[SlotColumn.Location][row] = packLocation(SLOT_ARCHETYPE_NONE, 0);
        } else if (this._entityCount <= ENTITY_INDEX_MASK) {
            index = this.appendEntitySlot();
            version = 1;
            const tableIdx = Math.floor(index / this._slotCapacity);
            const row = index - tableIdx * this._slotCapacity;
            const columns = this._slotTables[tableIdx].columns;
            columns[SlotColumn.VersionState][row] = SLOT_ALIVE | version;
            columns[SlotColumn.Location][row] = packLocation(SLOT_ARCHETYPE_NONE, 0);
        } else if (this._quarantinedEntityHead !== 0) {
            index = this._quarantinedEntityHead;
            const tableIdx = Math.floor(index / this._slotCapacity);
            const row = index - tableIdx * this._slotCapacity;
            const columns = this._slotTables[tableIdx].columns;
            this._quarantinedEntityHead = columns[SlotColumn.Location][row];
            version = 1;
            columns[SlotColumn.VersionState][row] = SLOT_ALIVE | version;
            columns[SlotColumn.Location][row] = packLocation(SLOT_ARCHETYPE_NONE, 0);
        } else {
            throw new RangeError(`Entity capacity exceeded: ${ENTITY_INDEX_MASK}`);
        }

        return (((index << ENTITY_VERSION_BITS) | version) >>> 0) as Entity;
    }

    /** 销毁实体并回收句柄槽位；实体无效时返回 false。 */
    @Disposable.guard
    despawn(entity: Entity): boolean {
        const location = this.readEntityLocation(entity);
        if (location === INVALID_LOCATION) return false;
        const index = entity >>> ENTITY_VERSION_BITS;
        const archetypeIdx = archetypeOf(location);
        if (archetypeIdx !== SLOT_ARCHETYPE_NONE) {
            const archetype = this._archetypes[archetypeIdx];
            if (!archetype) return false;
            const archetypeRow = rowOf(location);
            if (!archetype.valid(archetypeRow)) return false;
            const moved = archetype.remove(archetypeRow);
            if (moved !== undefined) this.setEntityLocation(moved, archetypeIdx, archetypeRow);
        }
        this.releaseEntitySlot(index, entity & ENTITY_VERSION_MASK);
        return true;
    }

    /** 读取实体组件的单个字段；实体、组件或字段不存在时返回 null。 */
    @Disposable.guard
    get<T extends object, Field extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: Field,
    ): ComponentFieldValue<T, Field> | null {
        const component = this._components.getMeta(type);
        if (!component) return null;
        const location = this.readEntityLocation(entity);
        if (location === INVALID_LOCATION) return null;
        const archetypeIdx = archetypeOf(location);
        if (archetypeIdx === SLOT_ARCHETYPE_NONE) return null;
        const archetype = this._archetypes[archetypeIdx];
        return (archetype?.getField(rowOf(location), component.id, field) ?? null) as
            ComponentFieldValue<T, Field> | null;
    }

    /** 判断有效实体当前是否包含指定组件。 */
    @Disposable.guard
    has<T extends object>(entity: Entity, type: ComponentType<T>): boolean {
        const component = this._components.getMeta(type);
        if (!component) return false;
        const location = this.readEntityLocation(entity);
        if (location === INVALID_LOCATION) return false;
        const archetypeIdx = archetypeOf(location);
        const archetype = archetypeIdx === SLOT_ARCHETYPE_NONE
            ? undefined
            : this._archetypes[archetypeIdx];
        return archetype !== undefined && archetype.mask.has(component.mask);
    }

    /** 立即写入已有组件字段；实体、组件或字段不存在时返回 false。 */
    @Disposable.guard
    set<T extends object, Field extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: Field,
        value: ComponentFieldValue<T, Field>,
    ): boolean {
        const component = this._components.getMeta(type);
        if (!component || field < 0 || field >= component.layout.length) return false;
        const location = this.readEntityLocation(entity);
        if (location === INVALID_LOCATION) return false;
        const archetypeIdx = archetypeOf(location);
        if (archetypeIdx === SLOT_ARCHETYPE_NONE) return false;
        const archetype = this._archetypes[archetypeIdx];
        if (!archetype || !archetype.mask.has(component.mask)) return false;
        return archetype.setField(rowOf(location), component.id, field, value as number);
    }

    /** 返回实体所在 Chunk 的组件列视图；属于可能失效的 advanced 数据视图。 */
    @Disposable.guard
    view<T extends object>(entity: Entity, type: ComponentType<T>): ComponentColumns<T> | null {
        const component = this._components.getMeta(type);
        if (!component) return null;
        const location = this.readEntityLocation(entity);
        if (location === INVALID_LOCATION) return null;
        const archetypeIdx = archetypeOf(location);
        if (archetypeIdx === SLOT_ARCHETYPE_NONE) return null;
        const archetype = this._archetypes[archetypeIdx];
        return archetype
            ? archetype.getComp(rowOf(location), component.id) as ComponentColumns<T> | null
            : null;
    }

    /** 返回实体当前组件类型；诊断便利接口会分配新数组。 */
    @Disposable.guard
    getTypes(entity: Entity): readonly ComponentType[] | null {
        const location = this.readEntityLocation(entity);
        if (location === INVALID_LOCATION) return null;
        const archetypeIdx = archetypeOf(location);
        if (archetypeIdx === SLOT_ARCHETYPE_NONE) return null;
        const types = this._archetypes[archetypeIdx]?.types;
        return types ? types.map(component => component.type) : null;
    }

    /** 判断实体句柄的索引、版本和分配状态是否有效。 */
    @Disposable.guard
    valid(entity: Entity): boolean {
        const index = entity >>> ENTITY_VERSION_BITS;
        const version = entity & ENTITY_VERSION_MASK;
        if (version === 0 || index === 0 || index >= this._entityCount) return false;
        const tableIdx = Math.floor(index / this._slotCapacity);
        const row = index - tableIdx * this._slotCapacity;
        const state = this._slotTables[tableIdx].columns[SlotColumn.VersionState][row];
        return (state & SLOT_ALIVE) !== 0 && (state & ENTITY_VERSION_MASK) === version;
    }

    /**
     * 一次校验实体并解析当前 ArchetypeRow。
     *
     * 返回 `false` 表示实体无效；返回 `true` 且 `out.archetype === null` 表示实体有效但
     * 尚未迁移。调用者负责在结构变更后重新解析，不得长期缓存结果。
     */
    @Disposable.guard
    resolve(entity: Entity, out: EntityAccess): boolean {
        const location = this.readEntityLocation(entity);
        if (location === INVALID_LOCATION) {
            out.archetype = null;
            out.row = 0 as ArchetypeRow;
            return false;
        }
        const archetypeIdx = archetypeOf(location);
        if (archetypeIdx === SLOT_ARCHETYPE_NONE) {
            out.archetype = null;
            out.row = 0 as ArchetypeRow;
            return true;
        }
        const archetype = this._archetypes[archetypeIdx];
        if (!archetype) {
            out.archetype = null;
            out.row = 0 as ArchetypeRow;
            return false;
        }
        out.archetype = archetype;
        out.row = rowOf(location);
        return true;
    }

    /** 获取实体存储位置；诊断便利接口会分配结果对象。 */
    @Disposable.guard
    getCompLocation(entity: Entity): EntityLocation | null {
        const location = this.readEntityLocation(entity);
        if (location === INVALID_LOCATION) return null;
        const archetypeIdx = archetypeOf(location);
        if (archetypeIdx === SLOT_ARCHETYPE_NONE) return null;
        const archetype = this._archetypes[archetypeIdx];
        if (!archetype) return null;
        const archetypeRow = rowOf(location);
        return {
            chunkIdx: archetype.chunkIdxOf(archetypeRow),
            row: archetype.rowIdxOf(archetypeRow),
        };
    }

    /** 当前 World 借用的原始分配器；其所有权仍属于构造方。 */
    get allocator(): IAllocator { return this._allocator; }

    /** 当前全部 Archetype 的只读诊断视图与 Query 数据源。 */
    get archetypes(): readonly Archetype[] { return this._archetypes; }
    /** @internal Archetype 集合版本。 */
    get version(): number { return this._version; }

    /** 查询组件存储元数据，不触发注册。 */
    @Disposable.guard
    findComponent<T extends object>(type: ComponentType<T>): ComponentMeta<T> | undefined {
        return this._components.getMeta(type);
    }

    /** 按当前 World 的紧凑组件编号查询存储元数据。 */
    @Disposable.guard
    componentById(id: ComponentId): ComponentMeta | undefined {
        return this._components.getById(id);
    }

    /** @internal 按掩码取得或创建 Archetype。 */
    @Disposable.guard
    getOrCreateArchetype(mask: Mask, types: readonly ComponentMeta[]): Archetype {
        return this._archetypes[this.getOrCreateArchetypeIndex(mask, types)];
    }

    migrate(entity: Entity, mask: Mask, types: readonly ComponentMeta[], callback: (archetype: Archetype, row: ArchetypeRow) => void): boolean;
    migrate<Ctx>(entity: Entity, mask: Mask, types: readonly ComponentMeta[], callback: (this: Ctx, archetype: Archetype, row: ArchetypeRow) => void, ctx: Ctx): boolean;
    /** @internal 将实体立即迁移到指定组件集合。 */
    @Disposable.guard
    migrate<Ctx>(entity: Entity, mask: Mask, types: readonly ComponentMeta[], callback: (this: Ctx, archetype: Archetype, row: ArchetypeRow) => void, ctx?: Ctx): boolean {
        const oldPackedLocation = this.readEntityLocation(entity);
        if (oldPackedLocation === INVALID_LOCATION) return false;
        const newArchetypeIdx = this.getOrCreateArchetypeIndex(mask, types);
        const oldArchetypeIdx = archetypeOf(oldPackedLocation);
        const oldArchetype = oldArchetypeIdx === SLOT_ARCHETYPE_NONE
            ? undefined
            : this._archetypes[oldArchetypeIdx];
        const oldLocation = oldArchetype ? rowOf(oldPackedLocation) : null;
        const newArchetype = this._archetypes[newArchetypeIdx];

        if (oldArchetypeIdx !== newArchetypeIdx) {
            const newLocation = newArchetype.insert(entity);
            if (oldArchetype && oldLocation !== null) {
                oldArchetype.copyRowTo(oldLocation, newArchetype, newLocation);
                const moved = oldArchetype.remove(oldLocation);
                if (moved !== undefined) this.setEntityLocation(moved, oldArchetypeIdx, oldLocation);
            }
            this.setEntityLocation(entity, newArchetypeIdx, newLocation);
            if (ctx === undefined) {
                (callback as (archetype: Archetype, row: ArchetypeRow) => void)(
                    newArchetype,
                    newLocation,
                );
            }
            else callback.call(ctx, newArchetype, newLocation);
        } else if (oldLocation !== null) {
            if (ctx === undefined) {
                (callback as (archetype: Archetype, row: ArchetypeRow) => void)(
                    newArchetype,
                    oldLocation,
                );
            }
            else callback.call(ctx, newArchetype, oldLocation);
        }
        return true;
    }

    /** 释放 World 持有的全部实体数据并归还 Buffer，不清空构造方拥有的 IAllocator。 */
    protected doDispose(): void {
        let firstError: unknown;
        try { this._slotData.dispose(); }
        catch (error) { firstError ??= error; }
        for (let i = 0; i < this._archetypes.length; i++) {
            try { this._archetypes[i].dispose(); }
            catch (error) { firstError ??= error; }
        }
        this._archetypes.length = 0;
        this._archetypeMaskIndexes.length = 0;
        this._version++;
        this._entityCount = 0;
        this._freeEntityHead = 0;
        this._quarantinedEntityHead = 0;
        if (firstError !== undefined) throw firstError;
    }

    private readEntityLocation(entity: Entity): number {
        const index = entity >>> ENTITY_VERSION_BITS;
        const version = entity & ENTITY_VERSION_MASK;
        if (version === 0 || index === 0 || index >= this._entityCount) return INVALID_LOCATION;
        const tableIdx = Math.floor(index / this._slotCapacity);
        const row = index - tableIdx * this._slotCapacity;
        const columns = this._slotTables[tableIdx].columns;
        const state = columns[SlotColumn.VersionState][row];
        if ((state & SLOT_ALIVE) === 0 || (state & ENTITY_VERSION_MASK) !== version) {
            return INVALID_LOCATION;
        }
        return columns[SlotColumn.Location][row];
    }

    private setEntityLocation(entity: Entity, archetypeIdx: number, location: ArchetypeRow): void {
        const index = entity >>> ENTITY_VERSION_BITS;
        const tableIdx = Math.floor(index / this._slotCapacity);
        const row = index - tableIdx * this._slotCapacity;
        this._slotTables[tableIdx].columns[SlotColumn.Location][row] =
            packLocation(archetypeIdx, location);
    }

    private releaseEntitySlot(index: number, version: number): void {
        const tableIdx = Math.floor(index / this._slotCapacity);
        const row = index - tableIdx * this._slotCapacity;
        const columns = this._slotTables[tableIdx].columns;
        if (version === ENTITY_VERSION_MASK) {
            columns[SlotColumn.VersionState][row] = SLOT_QUARANTINED | version;
            columns[SlotColumn.Location][row] = this._quarantinedEntityHead;
            this._quarantinedEntityHead = index;
            return;
        }
        columns[SlotColumn.VersionState][row] = version + 1;
        columns[SlotColumn.Location][row] = this._freeEntityHead;
        this._freeEntityHead = index;
    }

    private appendEntitySlot(): number {
        const index = this._entityCount;
        const tableIdx = Math.floor(index / this._slotCapacity);
        if (tableIdx === this._slotTables.length) this._slotData.push();
        else if (tableIdx > this._slotTables.length) {
            throw new Error("Entity Slot Table sequence is not continuous");
        }
        this._entityCount++;
        return index;
    }

    private getOrCreateArchetypeIndex(mask: Mask, types: readonly ComponentMeta[]): number {
        const existing = this.findArchetypeIndex(mask);
        if (existing !== -1) return existing;
        const idx = this._archetypes.length;
        if (idx > MAX_ARCHETYPE_INDEX) {
            throw new RangeError(`Archetype capacity exceeded: ${MAX_ARCHETYPE_INDEX + 1}`);
        }
        const archetype = new Archetype(mask, types, this._allocator);
        this._archetypes.push(archetype);
        const indexes = this._archetypeMaskIndexes;
        let low = 0;
        let high = indexes.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (indexes[mid].mask.compare(archetype.mask) < 0) low = mid + 1;
            else high = mid;
        }
        indexes.splice(low, 0, { mask: archetype.mask, idx });
        this._version++;
        return idx;
    }

    private findArchetypeIndex(mask: Mask): number {
        const indexes = this._archetypeMaskIndexes;
        let low = 0;
        let high = indexes.length - 1;
        while (low <= high) {
            const mid = (low + high) >>> 1;
            const entry = indexes[mid];
            const comparison = entry.mask.compare(mask);
            if (comparison === 0) return entry.idx;
            if (comparison < 0) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }
}

function packLocation(archetypeIdx: number, row: number): number {
    return ((archetypeIdx << SLOT_ROW_BITS) | row) >>> 0;
}

function archetypeOf(location: number): number {
    return location >>> SLOT_ROW_BITS;
}

function rowOf(location: number): ArchetypeRow {
    return (location & SLOT_ROW_MASK) as ArchetypeRow;
}
