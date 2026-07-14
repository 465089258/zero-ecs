import type { ComponentMeta, ComponentType } from "./component";
import { ComponentService } from "./component-registry";

/** Unstable advanced access to World-local component storage metadata. */
export function defineComponentMeta<T extends object>(
    components: ComponentService,
    type: ComponentType<T>,
): ComponentMeta<T> {
    return components.defMeta(type);
}

/** Unstable advanced lookup that does not register the component. */
export function getComponentMeta<T extends object>(
    components: ComponentService,
    type: ComponentType<T>,
): ComponentMeta<T> | undefined {
    return components.getMeta(type);
}
