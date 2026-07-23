import type { ComponentTag } from "@zero-ecs/world";

/** @internal ChildOf 投影与 HierarchyService 共用的隐藏存储组件。 */
export class ChildOfStorage implements ComponentTag {}

/** @internal ParentOf 投影与 HierarchyService 共用的隐藏存储组件。 */
export class ParentOfStorage implements ComponentTag {}
