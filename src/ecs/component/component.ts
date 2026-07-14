import type { TypedArrayFor, Types } from "../../storage/typed-array";
import type { Mask } from "./mask";

declare const ComponentIdBrand: unique symbol;
declare const ComponentMetaBrand: unique symbol;

/**
 * Compile-time component schema contract.
 *
 * A mapped type is used here because TypeScript interfaces cannot express the
 * generic numeric fields required by `implements Component<MyFields>`.
 */
export type Component<K extends number> = Readonly<Record<K, Types>>;

/** A component schema constructor and its stable identity across ECS worlds. */
export type ComponentType<T extends object = object> = new () => T;

/** Numeric fields declared by a component schema. */
export type ComponentFields<T extends object> = Extract<keyof T, number>;

/** Typed-array columns belonging to one component in an Archetype table. */
export type ComponentColumns<T extends object> = {
    readonly [Field in ComponentFields<T>]:
        T[Field] extends Types ? TypedArrayFor<T[Field]> : never;
};

/** A component's world-local dense identifier. */
export type ComponentId = number & { readonly [ComponentIdBrand]: "ComponentId" };

/** Stable public information returned by ComponentService. */
export type ComponentDefinition<T extends object = object> = Readonly<{
    name: string;
    type: ComponentType<T>;
    layout: readonly Types[];
}>;

/** Runtime metadata owned by one ComponentService instance. */
export type ComponentMeta<T extends object = object> = ComponentDefinition<T> & Readonly<{
    id: ComponentId;
    mask: Mask;
}> & { readonly [ComponentMetaBrand]?: "ComponentMeta" };
