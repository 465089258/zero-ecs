import { createInjectDecorator, InjectionKind } from "./injection-metadata";

export type ResourceType<T extends Resource = Resource> = abstract new (...args: any[]) => T;
export type StateType<T extends State = State> = new () => T;
export type ServiceType<T extends Service = Service> = new () => T;

declare const ResourceBrand: unique symbol;
declare const StateBrand: unique symbol;
declare const ServiceBrand: unique symbol;

export abstract class Resource {
    protected declare readonly [ResourceBrand]: void;
    static inject<T extends Resource>(type: ResourceType<T>) {
        return createInjectDecorator(InjectionKind.Resource, type);
    }
}

export abstract class State {
    protected declare readonly [StateBrand]: void;
    static inject<T extends State>(type: StateType<T>) {
        return createInjectDecorator(InjectionKind.State, type);
    }
    init?(): void;
    dispose?(): void;
}

/** A collection of injectable tool methods. Frame behavior belongs in systems. */
export abstract class Service {
    protected declare readonly [ServiceBrand]: void;
    static inject<T extends Service>(type: ServiceType<T>) {
        return createInjectDecorator(InjectionKind.Service, type);
    }
    init?(): void;
    dispose?(): void;
}
