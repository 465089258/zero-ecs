/** 不稳定的 World 存储、诊断和显式底层能力。 */
export * from "./index";
export * from "./storage";
export { Archetype } from "./archetype/archetype";
export type { ArchetypeRow } from "./archetype/archetype";
export {
    ArchetypeChunk,
    ArchetypeChunks,
    ENTITY_COLUMN,
} from "./archetype/archetype-chunk";
export type {
    ArchetypeColumns,
    ComponentViews,
} from "./archetype/archetype-chunk";
export { Mask } from "./component/mask";
export type { ComponentId, ComponentMeta } from "./component/component";
export type { IArchetypeSource, IComponentResolver } from "./query/query";
export { entityIndexOf } from "./entity/entity-format";
