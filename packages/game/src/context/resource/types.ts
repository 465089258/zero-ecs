import { ClassType } from "../container";

declare const ResourceBrand: unique symbol;
/**
 * 构建阶段传入、运行期间不替换的只读依赖或能力。
 * 可以承载静态配置，也可以承载 DOM、Canvas、设备句柄等宿主能力。
 * Resource 不参与初始化和销毁生命周期。
 */
export abstract class Resource {
    protected declare readonly [ResourceBrand]: void;
}

/** Resource 子类的构造类型。 */
export type ResourceType<T extends Resource = Resource> = ClassType<T>;
