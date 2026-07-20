/** 不稳定的 World 存储、诊断和显式底层能力。 */
export * from "./index";
export * from "./storage";
export { Archetype, ENTITY_COLUMN } from "./archetype/archetype";
export type { ArchetypeRow } from "./archetype/archetype";
export { Mask } from "./component/mask";
export type { ComponentId, ComponentMeta } from "./component/component";
export { defineComponentMeta, getComponentMeta } from "./component/advanced";
export type { IArchetypeSource, IComponentResolver } from "./query/query";
export { unsafeStructureWriter } from "./world";
export type { UnsafeStructureWriter } from "./world";
export { archetypesOfWorld } from "./world";
