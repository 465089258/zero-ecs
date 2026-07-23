import type { ComponentMeta } from "../component/component";
import type { EntitySet } from "../entity/entity";
import { DataSet, Table, type TableLayout } from "../storage/data-set";
import type { Buffer, IAllocator } from "../storage/memory";
import {
    type E32,
    type TypedArray,
    type Types,
} from "../storage/typed-array";

/** Archetype Chunk 中保存实体句柄的稠密列索引。 */
export const ENTITY_COLUMN = 0;

/** Archetype Chunk 的物理列布局：实体列后依次排列组件字段列。 */
export type ArchetypeColumns = readonly [E32, ...Types[]];

/** 单个 Chunk 按 ComponentId 稀疏索引的组件字段列。 */
export type ComponentViews = ReadonlyArray<readonly TypedArray[] | undefined>;

/**
 * 单个 Archetype 物理 Chunk。
 *
 * `columns` 是适合整行复制的稠密物理索引；`views` 是指向相同 TypedArray 的
 * ComponentId 稀疏语义索引。两者不复制组件数据。
 */
export class ArchetypeChunk extends Table<ArchetypeColumns> {
    readonly entities: EntitySet;
    readonly views: ComponentViews;

    constructor(
        id: number,
        memory: Buffer,
        layout: TableLayout,
        types: readonly ComponentMeta[],
    ) {
        super(id, memory, layout);
        this.entities = this.columns[ENTITY_COLUMN] as EntitySet;
        this.views = createComponentViews(this.columns, types);
    }
}

/**
 * 一组布局相同的 ArchetypeChunk。
 *
 * 只负责 Chunk 的分配、释放和语义视图绑定，不拥有逻辑行、结构版本或空 Chunk 策略。
 */
export class ArchetypeChunks extends DataSet<ArchetypeColumns, ArchetypeChunk> {
    constructor(
        allocator: IAllocator,
        columns: ArchetypeColumns,
        private readonly components: readonly ComponentMeta[],
    ) {
        super(allocator, columns);
    }

    protected override createTable(id: number, memory: Buffer): ArchetypeChunk {
        return new ArchetypeChunk(id, memory, this.layout, this.components);
    }
}

function createComponentViews(
    columns: readonly TypedArray[],
    components: readonly ComponentMeta[],
): ComponentViews {
    const count = components.length === 0
        ? 0
        : components[components.length - 1].id + 1;
    const views: Array<readonly TypedArray[] | undefined> = [];
    views.length = count;
    let columnIdx = ENTITY_COLUMN + 1;
    for (let componentIdx = 0; componentIdx < components.length; componentIdx++) {
        const component = components[componentIdx];
        const fields = new Array<TypedArray>(component.layout.length);
        for (let fieldIdx = 0; fieldIdx < fields.length; fieldIdx++) {
            fields[fieldIdx] = columns[columnIdx++];
        }
        views[component.id] = fields;
    }
    return views;
}
