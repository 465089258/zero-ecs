import { defineQueryProjection, type ComponentTag } from "@zero-ecs/world";

/**
 * 查询“拥有父节点”的实体。
 *
 * 这是只读 Query 投影，不是 ComponentType，因而不能传给 EntityCommand.add/remove。
 * 具体父实体通过 HierarchyService.parentOf() 读取。
 */
export const ChildOf = defineQueryProjection<ComponentTag>("ChildOf");

/**
 * 查询“至少拥有一个子节点”的实体。
 *
 * 这是只读 Query 投影，不是 ComponentType；子链通过 HierarchyService 遍历。
 */
export const ParentOf = defineQueryProjection<ComponentTag>("ParentOf");

