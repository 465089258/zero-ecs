import type { IAllocator } from "../storage/memory";
import type { ComponentMeta } from "../component/component";
import { Mask } from "../component/mask";
import { Archetype } from "./archetype";

interface ArchetypeMaskIndex {
    mask: Mask;
    idx: number;
}

/** @internal World 内核持有的 Archetype 集合与掩码索引。 */
export class ArchetypeStore {
    private readonly _archetypes: Archetype[] = [];
    private readonly _maskIndexes: ArchetypeMaskIndex[] = [];
    private _version = 0;

    constructor(private readonly _allocator: IAllocator) {}

    get archetypes(): readonly Archetype[] { return this._archetypes; }
    get version(): number { return this._version; }

    getAtIdx(idx: number): Archetype | undefined { return this._archetypes[idx]; }

    getIdxAtMask(mask: Mask): number {
        const indexes = this._maskIndexes;
        let low = 0;
        let high = indexes.length - 1;
        while (low <= high) {
            const mid = (low + high) >>> 1;
            const entry = indexes[mid];
            const cmp = entry.mask.compare(mask);
            if (cmp === 0) return entry.idx;
            if (cmp < 0) low = mid + 1;
            else high = mid - 1;
        }
        return -1;
    }

    getIdxOrNewAtMask(mask: Mask, types: readonly ComponentMeta[]): number {
        let idx = this.getIdxAtMask(mask);
        if (idx !== -1) return idx;
        idx = this._archetypes.length;
        const archetype = new Archetype(mask, types, this._allocator);
        this._archetypes.push(archetype);
        this.bindArchetype(archetype, idx);
        this._version++;
        return idx;
    }

    getAtMask(mask: Mask): Archetype | undefined {
        const idx = this.getIdxAtMask(mask);
        return idx === -1 ? undefined : this._archetypes[idx];
    }

    getOrNewAtMask(mask: Mask, types: readonly ComponentMeta[]): Archetype {
        let archetype = this.getAtMask(mask);
        if (archetype) return archetype;
        const idx = this._archetypes.length;
        archetype = new Archetype(mask, types, this._allocator);
        this._archetypes.push(archetype);
        this.bindArchetype(archetype, idx);
        this._version++;
        return archetype;
    }

    dispose(): void {
        for (let i = 0; i < this._archetypes.length; i++) this._archetypes[i].dispose();
        this._archetypes.length = 0;
        this._maskIndexes.length = 0;
        this._version++;
    }

    private bindArchetype(archetype: Archetype, idx: number): void {
        const indexes = this._maskIndexes;
        let low = 0;
        let high = indexes.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            if (indexes[mid].mask.compare(archetype.mask) < 0) low = mid + 1;
            else high = mid;
        }
        indexes.splice(low, 0, { mask: archetype.mask, idx });
    }
}
