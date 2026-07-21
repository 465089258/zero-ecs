import type { ComponentType } from "./component/component";
import type { QueryProjection } from "./query/query-data";
import type { World } from "./world";

/** 只供 GameBuilder 使用的冷路径投影注册入口。 */
export function registerQueryProjection<T extends object>(
    world: World,
    projection: QueryProjection<T>,
    storage: ComponentType<T>,
): void {
    world.registerQueryProjection(projection, storage);
}
