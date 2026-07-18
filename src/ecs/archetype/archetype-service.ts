import { Service, State } from "../../context";
import type { Mut } from "../../schedule/system";
import { type ComponentMeta } from "../component/component";
import { Mask } from "../component/mask";
import { EcsMemoryService } from "../memory/ecs-memory-service";
import { Archetype } from "./archetype";

type ArchetypeMaskIndex = {
    mask: Mask;
    idx: number;
}

/** Archetype 集合及其运行时索引状态。 */
export class ArchetypeState extends State {
    readonly archetypes: Archetype[] = [];
    readonly maskIndexes: ArchetypeMaskIndex[] = [];
    readonly version: number = 0;
}

/** 按组件掩码创建、索引并管理当前 World 的 Archetype。 */
export class ArchetypeService extends Service {
    @Service.inject(EcsMemoryService)
    private readonly _memory!: EcsMemoryService;
    @State.inject(ArchetypeState)
    private readonly _state!: Mut<ArchetypeState>;

    /** 当前全部 Archetype 的只读列表。 */
    get archetypes(): readonly Archetype[] { return this._state.archetypes; }
    /** Archetype 集合版本；创建或整体释放时递增。 */
    get version(): number { return this._state.version; }

    /** 按内部索引获取 Archetype。 */
    getAtIdx(idx: number): Archetype | undefined {
        return this._state.archetypes[idx];
    }
    /** 按组件掩码查询内部索引；不存在时返回 `-1`。 */
    getIdxAtMask(mask: Mask): number {
        const indexes = this._state.maskIndexes;
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
    /** 按组件掩码查询或创建 Archetype，并返回内部索引。 */
    getIdxOrNewAtMask(mask: Mask, types: ComponentMeta[]): number {
        let idx = this.getIdxAtMask(mask);
        if (idx === -1) {
            const archetypes = this._state.archetypes;
            idx = archetypes.length;
            const arch = new Archetype(mask, types, this._memory.allocator);
            archetypes.push(arch);
            this.bindArchetype(arch, idx);
            this._state.version++;
        }
        return idx;
    }
    /** 按组件掩码查询 Archetype。 */
    getAtMask(mask: Mask): Archetype | undefined {
        const idx = this.getIdxAtMask(mask);
        if (idx === -1) return undefined;
        return this._state.archetypes[idx];
    }

    /** 按组件掩码查询或创建 Archetype。 */
    getOrNewAtMask(mask: Mask, types: readonly ComponentMeta[]): Archetype {
        const archetypes = this._state.archetypes;
        let arch = this.getAtMask(mask);
        if (!arch) {
            const idx = archetypes.length;
            arch = new Archetype(mask, types, this._memory.allocator);
            archetypes.push(arch);
            this.bindArchetype(arch, idx);
            this._state.version++;
        }
        return arch;
    }

    /** 释放全部 Archetype 及其 Table。 */
    dispose(): void {
        const state = this._state;
        for (let i = 0; i < state.archetypes.length; i++) state.archetypes[i].dispose();
        state.archetypes.length = 0;
        state.maskIndexes.length = 0;
        state.version++;
    }

    private bindArchetype(arch: Archetype, idx: number) {
        const indexes = this._state.maskIndexes;
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
