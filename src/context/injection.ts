import { createInjectDecorator, injectionEntries, InjectionKind } from "./injection-metadata";
import type { ResourceContainer, ServiceContainer, StateContainer } from "./containers";
import { Resource, type ResourceType, Service, type ServiceType, State, type StateType } from "./types";

export interface InjectionContext {
    readonly world: unknown;
    readonly resources: ResourceContainer;
    readonly states: StateContainer;
    readonly services: ServiceContainer;
}

export function createWorldInjectDecorator() {
    return createInjectDecorator(InjectionKind.World);
}

export function injectAll(instance: any, context: InjectionContext): void {
    let ctor = instance.constructor;
    while (ctor && ctor !== Function.prototype) {
        const entries = injectionEntries(ctor);
        if (entries) for (const entry of entries) {
            if (instance[entry.property] !== undefined) continue;
            if (instance instanceof Resource) {
                throw new Error(`Resource ${ctor.name} cannot use dependency injection`);
            }
            if (instance instanceof State && (
                entry.kind === InjectionKind.World ||
                entry.kind === InjectionKind.Service
            )) {
                const name = entry.kind === InjectionKind.World ? "World" : `Service ${entry.type!.name}`;
                throw new Error(`State ${ctor.name} cannot inject ${name}`);
            }
            switch (entry.kind) {
                case InjectionKind.World:
                    instance[entry.property] = context.world;
                    break;
                case InjectionKind.Resource:
                    instance[entry.property] = context.resources.get(entry.type as ResourceType);
                    break;
                case InjectionKind.State:
                    instance[entry.property] = context.states.get(entry.type as StateType);
                    break;
                case InjectionKind.Service:
                    instance[entry.property] = context.services.get(entry.type as ServiceType);
                    break;
            }
        }
        ctor = Object.getPrototypeOf(ctor);
    }
}
