import { type Table } from "../../storage/data-set";
import type { TypedArray } from "../../storage/typed-array";
import { ENTITY_COLUMN, type Archetype } from "../archetype/archetype";
import {
    type ComponentColumns,
    type ComponentMeta,
    type ComponentType,
} from "../component/component";
import { Mask } from "../component/mask";
import { EntitySet } from "../entity";
import { QueryNodeKind, type QueryTypeNode } from "./filter";
import { QueryType } from "./query-type";

export interface IComponentResolver { defMeta<T extends object>(type: ComponentType<T>): ComponentMeta<T> }
export interface IArchetypeSource { readonly version: number; readonly archetypes: readonly Archetype[] }

export type QueryOf<T> = T extends QueryType<infer Components> ? Query<Components> : never;
export type { ComponentColumns } from "../component/component";
export type QueryComponentView<T> = T extends object ? ComponentColumns<T> : undefined;
export type QueryCurrent<Components extends readonly (object | undefined)[]> = [
    count: number,
    entities: EntitySet,
    ...components: { [Index in keyof Components]: QueryComponentView<Components[Index]> },
];

interface SymbolicClause { required: ComponentType[]; excluded: ComponentType[] }
interface CompiledClause { requiredMask: Mask; excludedMask: Mask }
interface Selection { type: ComponentType; meta: ComponentMeta; optional: boolean }
interface QueryTableEntry<Components extends readonly (object | undefined)[]> {
    table: Table | undefined;
    readonly current: QueryCurrent<Components>;
    readonly componentViews: TypedArray[][];
}

const MAX_DNF_CLAUSES = 256;

export class QueryIter<Components extends readonly (object | undefined)[]> {
    private _entries: readonly QueryTableEntry<Components>[] = [];
    private _length = 0;
    private _index = 0;
    /** Valid only after next() returns true. Reused between iterations. */
    current!: QueryCurrent<Components>;

    /** @internal Query-owned iterator reset. */
    reset(entries: readonly QueryTableEntry<Components>[], length: number): this {
        this._entries = entries;
        this._length = length;
        this._index = 0;
        return this;
    }

    next(): boolean {
        const entries = this._entries;
        const length = this._length;
        let index = this._index;

        while (index < length) {
            const entry = entries[index++];
            const count = entry.table!.count;
            if (count === 0) continue;

            const current = entry.current;
            current[0] = count;
            this._index = index;
            this.current = current;
            return true;
        }

        this._index = length;
        return false;
    }
}

export class Query<Components extends readonly (object | undefined)[]> {
    private readonly _clauses: CompiledClause[];
    private readonly _selections: Selection[];
    private readonly _entries: QueryTableEntry<Components>[] = [];
    private readonly _iterator = new QueryIter<Components>();
    private readonly _matched: Archetype[] = [];
    private readonly _dataVersions: number[] = [];
    private _entryCount = 0;
    private _archetypeVersion = -1;

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
        this.rebuild();
    }

    iter(): QueryIter<Components> {
        if (this.needsRefresh()) this.rebuild();
        return this._iterator.reset(this._entries, this._entryCount);
    }

    private collectSelections(ast: QueryTypeNode): Selection[] {
        const selections: Selection[] = [];
        const selected = new Map<ComponentType, QueryNodeKind.With | QueryNodeKind.Optional>();
        const optionalTypes = new Set<ComponentType>();
        const constrainedTypes = new Set<ComponentType>();
        const visit = (node: QueryTypeNode, insideAny: boolean): void => {
            switch (node.kind) {
                case QueryNodeKind.With:
                    for (const type of node.components) {
                        constrainedTypes.add(type);
                        const previous = selected.get(type);
                        if (previous !== undefined) throw new Error(`Component ${type.name} is selected more than once`);
                        selected.set(type, QueryNodeKind.With);
                        selections.push({ type, meta: this._components.defMeta(type), optional: insideAny });
                    }
                    break;
                case QueryNodeKind.Optional:
                    if (insideAny) throw new Error("Optional cannot be used inside Any");
                    for (const type of node.components) {
                        optionalTypes.add(type);
                        const previous = selected.get(type);
                        if (previous !== undefined) throw new Error(`Component ${type.name} is selected more than once`);
                        selected.set(type, QueryNodeKind.Optional);
                        selections.push({ type, meta: this._components.defMeta(type), optional: true });
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
            if (constrainedTypes.has(type)) throw new Error(`Optional component ${type.name} cannot also be used by With or Without`);
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
            for (const type of clause.required) requiredMask.orInto(this._components.defMeta(type).mask);
            for (const type of clause.excluded) excludedMask.orInto(this._components.defMeta(type).mask);
            return { requiredMask, excludedMask };
        });
    }

    private matches(archetype: Archetype): boolean {
        const clauses = this._clauses;
        for (let i = 0; i < clauses.length; i++) {
            const clause = clauses[i];
            if (archetype.mask.has(clause.requiredMask) && archetype.mask.not(clause.excludedMask)) return true;
        }
        return false;
    }

    private needsRefresh(): boolean {
        if (this._archetypeVersion !== this._archetypes.version) return true;
        const matched = this._matched;
        for (let i = 0; i < matched.length; i++) {
            const archetype = matched[i];
            if (this._dataVersions[i] !== archetype.data.version) return true;
        }
        return false;
    }

    private rebuild(): void {
        let matchedCount = 0;
        let entryCount = 0;
        const archetypes = this._archetypes.archetypes;
        for (let archetypeIndex = 0; archetypeIndex < archetypes.length; archetypeIndex++) {
            const archetype = archetypes[archetypeIndex];
            if (!this.matches(archetype)) continue;
            this._matched[matchedCount] = archetype;
            this._dataVersions[matchedCount++] = archetype.data.version;
            const tables = archetype.tables;
            for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
                this.writeEntry(entryCount++, archetype, tables[tableIndex]);
            }
        }
        this._matched.length = matchedCount;
        this._dataVersions.length = matchedCount;
        this.releaseInactiveEntries(entryCount);
        this._entryCount = entryCount;
        this._archetypeVersion = this._archetypes.version;
    }

    private writeEntry(index: number, archetype: Archetype, table: Table): void {
        let entry = this._entries[index];
        if (!entry) {
            const current: unknown[] = new Array(2 + this._selections.length);
            const componentViews: TypedArray[][] = new Array(this._selections.length);
            for (let i = 0; i < componentViews.length; i++) componentViews[i] = [];
            entry = {
                table,
                current: current as QueryCurrent<Components>,
                componentViews,
            };
            this._entries.push(entry);
        } else {
            entry.table = table;
        }
        const current = entry.current as unknown[];
        current[0] = table.count;
        current[1] = table.columns[ENTITY_COLUMN] as Uint32Array;
        for (let i = 0; i < this._selections.length; i++) {
            const selection = this._selections[i];
            const columns = archetype.getTableComponent(table, selection.meta.id, entry.componentViews[i]);
            if (!columns && !selection.optional) throw new Error(`Required component ${selection.meta.name} is missing from matched archetype`);
            current[i + 2] = columns;
        }
    }

    private releaseInactiveEntries(activeCount: number): void {
        for (let i = activeCount; i < this._entries.length; i++) {
            const entry = this._entries[i];
            entry.table = undefined;
            const current = entry.current as unknown[];
            current[0] = 0;
            current[1] = undefined;
            for (let viewIndex = 0; viewIndex < entry.componentViews.length; viewIndex++) {
                entry.componentViews[viewIndex].length = 0;
                current[viewIndex + 2] = undefined;
            }
        }
    }
}
