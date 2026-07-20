import type { TypedArrayFor, Types } from "../storage/typed-array";
import type { Mask } from "./mask";

declare const ComponentIdBrand: unique symbol;
declare const ComponentMetaBrand: unique symbol;

/**
 * 组件字段定义约束。
 *
 * 组件类必须为字段枚举中的每个成员声明一种 {@link Types}，遗漏字段会产生类型错误。
 */
export type Component<K extends number> = Readonly<Record<K, Types>>;

/** 组件定义类；类本身作为组件在不同 World 间共享的稳定标识。 */
export type ComponentType<T extends object = object> = new () => T;

/** 组件定义中的数字字段键。 */
export type ComponentFields<T extends object> = Extract<keyof T, number>;

/** 组件在一个 Archetype Table 中对应的 TypedArray 列集合。 */
export type ComponentColumns<T extends object> = {
    readonly [Field in ComponentFields<T>]:
        T[Field] extends Types ? TypedArrayFor<T[Field]> : never;
};

/** 组件在当前 World 内的紧凑编号。 */
export type ComponentId = number & { readonly [ComponentIdBrand]: "ComponentId" };

/** World 对外提供的只读组件定义。 */
export type ComponentDefinition<T extends object = object> = Readonly<{
    name: string;
    type: ComponentType<T>;
    layout: readonly Types[];
}>;

/** 当前 World 独有的组件运行时元数据。 */
export type ComponentMeta<T extends object = object> = ComponentDefinition<T> & Readonly<{
    id: ComponentId;
    mask: Mask;
}> & { readonly [ComponentMetaBrand]?: "ComponentMeta" };
