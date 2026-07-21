import type { ComponentTag } from "@zero-ecs/world";

/** @internal 只由 HierarchyModule 注册；不从任何公共入口导出。 */
export class ChildOfStorage implements ComponentTag {}

/** @internal 只由 HierarchyModule 注册；不从任何公共入口导出。 */
export class ParentOfStorage implements ComponentTag {}

