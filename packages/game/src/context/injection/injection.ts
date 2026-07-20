import { createInjectDecorator, injectionEntries } from "./metadata";
import type { World } from "@zero-ecs/world";
import type { ResourceContainer } from "../resource";
import type { ServiceContainer } from "../service";
import { State, type StateContainer } from "../state";


/** @internal World、InjectionService 与 Scheduler 共享的运行时上下文。 */
export interface InjectionContext {
    readonly world: World;
    readonly resources: ResourceContainer;
    readonly states: StateContainer;
    readonly services: ServiceContainer;
}

const WorldSymbol = Symbol("WorldMetadata");

/** Game 注入能力的统一声明入口。 */
export const Inject = Object.freeze({
    /**
     * 声明 World 属性依赖。推荐将字段声明为 `WorldView`；完整 `World` 是显式逃生口。
     */
    world: () => createInjectDecorator(WorldSymbol),
});

/** @internal 按元数据向实例写入依赖。 */
function injectAllWorld(instance: any, context: InjectionContext): void {
    let ctor = instance.constructor;
    while (ctor && ctor !== Function.prototype) {
        const entries = injectionEntries(ctor, WorldSymbol);
        if (entries) for (const entry of entries) {
            if (instance[entry.property] !== undefined) continue;
            instance[entry.property] = context.world;
        }
        ctor = Object.getPrototypeOf(ctor);
    }
}

/** @internal 按元数据向实例写入依赖。 */
export function injectAll(instance: any, context: InjectionContext): void {
    if (instance instanceof State) {
        if (hasWorldInjection(instance)) {
            throw new Error(`State ${instance.constructor.name} cannot inject World`);
        }
        if (context.services.hasInjection(instance)) {
            throw new Error(`State ${instance.constructor.name} cannot inject Service`);
        }
    }
    injectAllWorld(instance, context);
    context.resources.injectAll(instance);
    context.services.injectAll(instance);
    context.states.injectAll(instance);
}

function hasWorldInjection(instance: any): boolean {
    let ctor = instance.constructor;
    while (ctor && ctor !== Function.prototype) {
        if (injectionEntries(ctor, WorldSymbol)?.length) return true;
        ctor = Object.getPrototypeOf(ctor);
    }
    return false;
}
