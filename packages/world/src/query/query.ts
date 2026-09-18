import { type Archetype } from "../archetype/archetype";
import {
    type ComponentColumns,
    type ComponentMeta,
    type ReadonlyComponentColumns,
} from "../component/component";
import { Mask } from "../component/mask";
import { EntitySet } from "../entity";
import { QueryNodeKind, type QueryTypeNode } from "./filter";
import {
    type ProjectedQueryData,
    type QueryDataType,
    queryDataName,
} from "./query-data";
import { QueryType } from "./query-type";

/** Query 构造时所需的组件解析接口。 */
export interface IComponentResolver {
    defQueryMeta<T extends object>(type: QueryDataType<T>): ComponentMeta<T>;
}
/** Query 构造时所需的原型数据源接口。 */
export interface IArchetypeSource {
    /** 存活期间追加 Archetype、终态清空时递增。 */
    readonly version: number;
    readonly archetypes: readonly Archetype[];
}

/** 从 QueryType 推导对应的运行时 Query 类型。 */
export type QueryOf<T> = T extends QueryType<infer Components> ? Query<Components> : never;
export type { ComponentColumns } from "../component/component";
/** 单个组件在当前 Chunk 中的列视图；可选组件可能为 `undefined`。 */
export type QueryComponentView<T> =
    T extends ProjectedQueryData<infer Value extends object> ? ReadonlyComponentColumns<Value> :
    T extends object ? ComponentColumns<T> :
    undefined;
/** `QueryIter.current` 返回的当前 Chunk 数据。 */
export type QueryCurrent<Components extends readonly (object | undefined)[]> = [
    count: number,
    entities: EntitySet,
    ...components: { [Index in keyof Components]: QueryComponentView<Components[Index]> },
];

interface SymbolicClause { required: QueryDataType[]; excluded: QueryDataType[] }
interface CompiledClause { requiredMask: Mask; excludedMask: Mask }
interface Selection { type: QueryDataType; meta: ComponentMeta; optional: boolean }
interface QueryChunkEntry<Components extends readonly (object | undefined)[]> {
    readonly current: QueryCurrent<Components>;
}
interface QueryArchetypeEntry<Components extends readonly (object | undefined)[]> {
    readonly archetype: Archetype;
    readonly chunks: QueryChunkEntry<Components>[];
    chunkCount: number;
    version: number;
}

const MAX_DNF_CLAUSES = 256;

function synchronizeChunks<Components extends readonly (object | undefined)[]>(
    archetypeEntry: QueryArchetypeEntry<Components>,
    selections: readonly Selection[],
): void {
    const archetype = archetypeEntry.archetype;
    const activeCount = archetype.allocatedChunkCount;
    let stableCount = Math.min(archetypeEntry.chunkCount, activeCount);

    while (stableCount > 0) {
        const chunkIdx = stableCount - 1;
        const chunk = archetype.chunkAt(chunkIdx);
        if (chunk && archetypeEntry.chunks[chunkIdx].current[1] === chunk.entities) break;
        stableCount--;
    }
    for (let chunkIdx = stableCount; chunkIdx < archetypeEntry.chunkCount; chunkIdx++) {
        releaseEntry(archetypeEntry.chunks[chunkIdx], selections.length);
    }
    for (let chunkIdx = stableCount; chunkIdx < activeCount; chunkIdx++) {
        writeEntry(archetypeEntry, chunkIdx, selections);
    }
    archetypeEntry.chunkCount = activeCount;
    archetypeEntry.version = archetype.version;
}

function writeEntry<Components extends readonly (object | undefined)[]>(
    archetypeEntry: QueryArchetypeEntry<Components>,
    chunkIdx: number,
    selections: readonly Selection[],
): void {
    const archetype = archetypeEntry.archetype;
    const chunk = archetype.chunkAt(chunkIdx);
    if (!chunk) throw new Error(`Archetype Chunk ${chunkIdx} is missing`);
    let entry = archetypeEntry.chunks[chunkIdx];
    if (!entry) {
        const current: unknown[] = new Array(2 + selections.length);
        entry = {
            current: current as QueryCurrent<Components>,
        };
        archetypeEntry.chunks.push(entry);
    }
    const current = entry.current as unknown[];
    current[0] = archetype.chunkRowCount(chunkIdx);
    current[1] = chunk.entities;
    const views = chunk.views;
    for (let i = 0; i < selections.length; i++) {
        const selection = selections[i];
        const columns = views[selection.meta.id];
        if (!columns && !selection.optional) {
            throw new Error(`Required component ${selection.meta.name} is missing from matched archetype`);
        }
        current[i + 2] = columns;
    }
}

function releaseEntry<Components extends readonly (object | undefined)[]>(
    entry: QueryChunkEntry<Components>,
    selectionCount: number,
): void {
    const current = entry.current as unknown[];
    current[0] = 0;
    current[1] = undefined;
    for (let viewIndex = 0; viewIndex < selectionCount; viewIndex++) {
        current[viewIndex + 2] = undefined;
    }
}

/**
 * 按 Archetype Chunk 遍历查询结果的低分配迭代器。
 *
 * 迭代器及 `current` 元组由 Query 复用；请勿缓存结果，也不要在同一 Query 上嵌套迭代。
 */
export class QueryIter<Components extends readonly (object | undefined)[]> {
    private _entries: readonly QueryArchetypeEntry<Components>[] = [];
    private _selections: readonly Selection[] = [];
    private _length = 0;
    private _archetypeIndex = 0;
    private _chunkIndex = 0;
    /** 当前 Chunk 的列视图；仅在 {@link next} 返回 `true` 后有效，并会被后续迭代复用。 */
    current!: QueryCurrent<Components>;

    /** @internal 重置 Query 持有的复用迭代器。 */
    reset(
        entries: readonly QueryArchetypeEntry<Components>[],
        length: number,
        selections: readonly Selection[],
    ): this {
        this._entries = entries;
        this._length = length;
        this._selections = selections;
        this._archetypeIndex = 0;
        this._chunkIndex = 0;
        return this;
    }

    /** 前进到下一个非空 Chunk；成功时返回 `true` 并更新 {@link current}。 */
    next(): boolean {
        const entries = this._entries;
        const selections = this._selections;
        const length = this._length;
        let archetypeIndex = this._archetypeIndex;
        let chunkIndex = this._chunkIndex;

        while (archetypeIndex < length) {
            const archetypeEntry = entries[archetypeIndex];
            if (chunkIndex === 0 && archetypeEntry.version !== archetypeEntry.archetype.version) {
                synchronizeChunks(archetypeEntry, selections);
            }
            while (chunkIndex < archetypeEntry.chunkCount) {
                const currentChunkIndex = chunkIndex++;
                const entry = archetypeEntry.chunks[currentChunkIndex];
                const count = archetypeEntry.archetype.chunkRowCount(currentChunkIndex);
                if (count === 0) continue;

                const current = entry.current;
                current[0] = count;
                this._archetypeIndex = archetypeIndex;
                this._chunkIndex = chunkIndex;
                this.current = current;
                return true;
            }
            archetypeIndex++;
            chunkIndex = 0;
        }

        this._archetypeIndex = length;
        this._chunkIndex = 0;
        return false;
    }
}

/** 根据 QueryType 匹配 Archetype 并提供 Chunk 级列视图。 */
export class Query<Components extends readonly (object | undefined)[]> {
    private readonly _clauses: CompiledClause[];
    private readonly _selections: Selection[];
    private readonly _entries: QueryArchetypeEntry<Components>[] = [];
    private readonly _iterator = new QueryIter<Components>();
    private _knownArchetypeCount = 0;
    private _worldVersion = -1;

    /** 使用组件解析器与原型数据源创建运行时查询；通常由 World.query() 调用。 */
    constructor(
        readonly type: QueryType<Components>,
        private readonly _components: IComponentResolver,
        private readonly _archetypes: IArchetypeSource,
    ) {
        const selections = this.collectSelections(type.ast);
        const symbolic = this.toDnf(type.ast);
        this._clauses = this.compileClauses(symbolic);
        for (const selection of selections) {
            selection.optional ||= !symbolic.every(clause => clause.required.indexOf(selection.type) !== -1);
        }
        this._selections = selections;
        this.synchronizeArchetypes();
    }

    /**
     * 重置并返回当前 Query 持有的迭代器。
     *
     * 同一 Query 始终复用一个迭代器，因此不支持嵌套调用。
     */
    iter(): QueryIter<Components> {
        if (this._worldVersion !== this._archetypes.version) {
            this.synchronizeArchetypes();
        }
        return this._iterator.reset(this._entries, this._entries.length, this._selections);
    }

    private collectSelections(ast: QueryTypeNode): Selection[] {
        const selections: Selection[] = [];
        const selected = new Map<
            QueryDataType,
            typeof QueryNodeKind.With | typeof QueryNodeKind.Optional
        >();
        const optionalTypes = new Set<QueryDataType>();
        const constrainedTypes = new Set<QueryDataType>();
        const visit = (node: QueryTypeNode, insideAny: boolean): void => {
            switch (node.kind) {
                case QueryNodeKind.With:
                    for (const type of node.components) {
                        constrainedTypes.add(type);
                        const previous = selected.get(type);
                        if (previous !== undefined) throw new Error(`Component ${queryDataName(type)} is selected more than once`);
                        selected.set(type, QueryNodeKind.With);
                        selections.push({ type, meta: this._components.defQueryMeta(type), optional: insideAny });
                    }
                    break;
                case QueryNodeKind.Optional:
                    if (insideAny) throw new Error("Optional cannot be used inside Any");
                    for (const type of node.components) {
                        optionalTypes.add(type);
                        const previous = selected.get(type);
                        if (previous !== undefined) throw new Error(`Component ${queryDataName(type)} is selected more than once`);
                        selected.set(type, QueryNodeKind.Optional);
                        selections.push({ type, meta: this._components.defQueryMeta(type), optional: true });
                    }
                    break;
                case QueryNodeKind.Without:
                    for (const type of node.components) constrainedTypes.add(type);
                    break;
                case QueryNodeKind.All:
                    for (const child of node.children) visit(child, insideAny);
                    break;
                case QueryNodeKind.Any:
                    for (const child of node.children) visit(child, true);
                    break;
            }
        };
        visit(ast, false);
        for (const type of optionalTypes) {
            if (constrainedTypes.has(type)) {
                throw new Error(`Optional component ${queryDataName(type)} cannot also be used by With or Without`);
            }
        }
        return selections;
    }

    private toDnf(node: QueryTypeNode): SymbolicClause[] {
        switch (node.kind) {
            case QueryNodeKind.With:
                return [{ required: [...node.components], excluded: [] }];
            case QueryNodeKind.Without:
                return [{ required: [], excluded: [...node.components] }];
            case QueryNodeKind.Optional:
                return [{ required: [], excluded: [] }];
            case QueryNodeKind.Any: {
                const result: SymbolicClause[] = [];
                for (const child of node.children) result.push(...this.toDnf(child));
                if (result.length > MAX_DNF_CLAUSES) throw new Error(`Query DNF exceeds ${MAX_DNF_CLAUSES} clauses`);
                return this.normalizeClauses(result);
            }
            case QueryNodeKind.All: {
                let result: SymbolicClause[] = [{ required: [], excluded: [] }];
                for (const child of node.children) {
                    const right = this.toDnf(child);
                    const merged: SymbolicClause[] = [];
                    for (const leftClause of result) for (const rightClause of right) {
                        merged.push({ required: [...leftClause.required, ...rightClause.required], excluded: [...leftClause.excluded, ...rightClause.excluded] });
                        if (merged.length > MAX_DNF_CLAUSES) throw new Error(`Query DNF exceeds ${MAX_DNF_CLAUSES} clauses`);
                    }
                    result = this.normalizeClauses(merged);
                }
                return result;
            }
        }
    }

    private normalizeClauses(clauses: SymbolicClause[]): SymbolicClause[] {
        const result: SymbolicClause[] = [];
        for (const clause of clauses) {
            const required = [...new Set(clause.required)];
            const excluded = [...new Set(clause.excluded)];
            if (required.some(type => excluded.indexOf(type) !== -1)) continue;
            result.push({ required, excluded });
        }
        return result;
    }

    private compileClauses(clauses: SymbolicClause[]): CompiledClause[] {
        return clauses.map(clause => {
            const requiredMask = Mask.empty();
            const excludedMask = Mask.empty();
            for (const type of clause.required) requiredMask.orInto(this._components.defQueryMeta(type).mask);
            for (const type of clause.excluded) excludedMask.orInto(this._components.defQueryMeta(type).mask);
            return { requiredMask, excludedMask };
        });
    }

    private matches(archetype: Archetype): boolean {
        const clauses = this._clauses;
        const archetypeMask = archetype.mask;
        const archetypeLen = archetypeMask.length;
        for (let i = 0; i < clauses.length; i++) {
            const clause = clauses[i];
            // 剪枝 1: excludedMask 优先。not() 在发现第一个交集时立即返回 false，
            // 对于典型 Without(X) 场景只需 1 个 word 检查，比 has() 全量遍历更短。
            if (clause.excludedMask.length > 0 && !archetypeMask.not(clause.excludedMask)) continue;
            // 剪枝 2: length 下界。archetype 的最高有效位还没有 requiredMask 高 → 不可能包含。
            if (archetypeLen < clause.requiredMask.length) continue;
            if (archetypeMask.has(clause.requiredMask)) return true;
        }
        return false;
    }

    private synchronizeArchetypes(): void {
        const archetypes = this._archetypes.archetypes;
        // 数据源存活期间只追加 Archetype；缩短表示终态释放。
        if (archetypes.length < this._knownArchetypeCount) {
            this.releaseAllEntries();
            this._knownArchetypeCount = 0;
        }
        for (let archetypeIndex = this._knownArchetypeCount; archetypeIndex < archetypes.length; archetypeIndex++) {
            const archetype = archetypes[archetypeIndex];
            if (!this.matches(archetype)) continue;
            const entry: QueryArchetypeEntry<Components> = {
                archetype,
                chunks: [],
                chunkCount: 0,
                version: -1,
            };
            this._entries.push(entry);
            synchronizeChunks(entry, this._selections);
        }
        this._knownArchetypeCount = archetypes.length;
        this._worldVersion = this._archetypes.version;
    }

    private releaseAllEntries(): void {
        for (let entryIdx = 0; entryIdx < this._entries.length; entryIdx++) {
            const archetypeEntry = this._entries[entryIdx];
            for (let chunkIdx = 0; chunkIdx < archetypeEntry.chunkCount; chunkIdx++) {
                releaseEntry(archetypeEntry.chunks[chunkIdx], this._selections.length);
            }
            archetypeEntry.chunkCount = 0;
            archetypeEntry.version = -1;
        }
        this._entries.length = 0;
    }
}
