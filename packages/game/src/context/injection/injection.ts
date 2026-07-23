import {
    createInjectDecorator,
    InjectionKeys,
    injectionEntries,
} from "./metadata";
import type { World } from "@zero-ecs/world";
import type {
    Resource,
    ResourceContainer,
    ResourceType,
} from "../resource";
import type {
    Service,
    ServiceContainer,
    ServiceToken,
} from "../service";
import {
    State,
    type StateContainer,
    type StateType,
} from "../state";


/** @internal World、InjectionService 与 Scheduler 共享的运行时上下文。 */
export interface InjectionContext {
    readonly world: World;
    readonly resources: ResourceContainer;
    readonly states: StateContainer;
    readonly services: ServiceContainer;
}

/** Game 注入能力的统一声明入口。 */
export const Inject = Object.freeze({
    /**
     * 声明 World 属性依赖。World 是底层 ECS 内核，调用方负责结构修改时序安全。
     */
    world: () => createInjectDecorator(InjectionKeys.world),
    /** 声明一个 Resource 属性依赖。 */
    resource: <T extends Resource>(type: ResourceType<T>) =>
        createInjectDecorator(InjectionKeys.resource, type),
    /** 声明一个 State 属性依赖。 */
    state: <T extends State>(type: StateType<T>) =>
        createInjectDecorator(InjectionKeys.state, type),
    /** 声明一个 Service 属性依赖。 */
    service: <T extends Service>(type: ServiceToken<T>) =>
        createInjectDecorator(InjectionKeys.service, type),
});

/** @internal 按元数据向实例写入依赖。 */
function injectAllWorld(instance: any, context: InjectionContext): void {
    let ctor = instance.constructor;
    while (ctor && ctor !== Function.prototype) {
        const entries = injectionEntries(ctor, InjectionKeys.world);
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
        if (injectionEntries(ctor, InjectionKeys.world)?.length) return true;
        ctor = Object.getPrototypeOf(ctor);
    }
    return false;
}
