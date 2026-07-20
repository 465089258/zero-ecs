import type { ComponentMeta, ComponentType } from "./component";
import { World } from "../world";

/** 不稳定的高级接口：定义组件并返回当前 World 的存储元数据。 */
export function defineComponentMeta<T extends object>(
    world: World,
    type: ComponentType<T>,
): ComponentMeta<T> {
    return world.defineComponentMeta(type);
}

/** 不稳定的高级接口：查询当前 World 的组件元数据，不触发注册。 */
export function getComponentMeta<T extends object>(
    world: World,
    type: ComponentType<T>,
): ComponentMeta<T> | undefined {
    return world.getComponentMeta(type);
}
