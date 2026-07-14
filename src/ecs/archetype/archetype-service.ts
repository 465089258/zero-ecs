import { Service } from "../../context/types";
import { type ComponentMeta } from "../component/component";
import { Mask } from "../component/mask";
import { EcsMemoryService } from "../memory/ecs-memory-service";
import { Archetype } from "./archetype";

type ArchetypeMaskIndex = {
    mask: Mask;
    idx: number;
}

export class ArchetypeService extends Service {
    @Service.inject(EcsMemoryService)
    private readonly _memory!: EcsMemoryService;
    // ========== Archetype 管理 ==========
    private _archetypes: Archetype[] = [];
    private _maskIndexes: ArchetypeMaskIndex[] = [];
    private _version = 0;

    get archetypes(): readonly Archetype[] { return this._archetypes; }
    get version(): number { return this._version; }

    getAtIdx(idx: number): Archetype | undefined {
        return this._archetypes[idx];
    }
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
    getIdxOrNewAtMask(mask: Mask, types: ComponentMeta[]): number {
        let idx = this.getIdxAtMask(mask);
        if (idx === -1) {
            const archetypes = this._archetypes;
            idx = archetypes.length;
            const arch = new Archetype(mask, types, this._memory.allocator);
            archetypes.push(arch);
            this.bindArchetype(arch, idx);
            this._version++;
        }
        return idx;
    }
    getAtMask(mask: Mask): Archetype | undefined {
        const idx = this.getIdxAtMask(mask);
        if (idx === -1) return undefined;
        return this._archetypes[idx];
    }

    getOrNewAtMask(mask: Mask, types: readonly ComponentMeta[]): Archetype {
        const archetypes = this._archetypes;
        let arch = this.getAtMask(mask);
        if (!arch) {
            const idx = archetypes.length;
            arch = new Archetype(mask, types, this._memory.allocator);
            archetypes.push(arch);
            this.bindArchetype(arch, idx);
            this._version++;
        }
        return arch;
    }

    dispose(): void {
        for (let i = 0; i < this._archetypes.length; i++) this._archetypes[i].dispose();
        this._archetypes.length = 0;
        this._maskIndexes.length = 0;
        this._version++;
    }

    private bindArchetype(arch: Archetype, idx: number) {
        const indexes = this._maskIndexes;
        let low = 0;
        let high = indexes.length;
        while (low < high) {
            const mid = (low + high) >>> 1;
            const cmp = indexes[mid].mask.compare(arch.mask);
            if (cmp < 0) low = mid + 1;
            else high = mid;
        }
        indexes.splice(low, 0, { mask: arch.mask, idx });
    }
}
