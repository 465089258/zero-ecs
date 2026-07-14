import type { ComponentMeta, ComponentType } from "./component";
import { ComponentService } from "./component-registry";

/** 不稳定的高级接口：定义组件并返回当前 World 的存储元数据。 */
export function defineComponentMeta<T extends object>(
    components: ComponentService,
    type: ComponentType<T>,
): ComponentMeta<T> {
    return components.defMeta(type);
}

/** 不稳定的高级接口：查询当前 World 的组件元数据，不触发注册。 */
export function getComponentMeta<T extends object>(
    components: ComponentService,
    type: ComponentType<T>,
): ComponentMeta<T> | undefined {
    return components.getMeta(type);
}
