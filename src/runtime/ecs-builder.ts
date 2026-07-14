import { QueryType } from "../ecs/query/query-type";
import {
    InjectionService,
    type InjectionContext,
    Resource,
    ResourceContainer,
    type ResourceType,
    Service,
    ServiceContainer,
    type ServiceType,
    State,
    StateContainer,
    type StateType,
} from "../context";
import { World } from "../context/world";
import { CoreEcsModule } from "../ecs/core-module";
import {
    isMutParam,
    Scheduler,
    type SystemDependencyTarget,
    type SystemFunction,
    type SystemHandle,
    type SystemOptions,
    type SystemParam,
    SystemScheduleBuilder,
    type UpdateStage,
} from "../schedule";
import { Ecs } from "./ecs";
import type { Module } from "./module";

/** Composition root for a World and its peer Scheduler. */
export class EcsBuilder {
    private readonly _resources = new Map<ResourceType, Resource>();
    private readonly _states = new Set<StateType>();
    private readonly _services = new Set<ServiceType>();
    private readonly _requiredResources = new Set<ResourceType>();
    private readonly _schedule = new SystemScheduleBuilder();
    private readonly _modules: Module[] = [];
    private _world = new World();
    private _built = false;

    constructor() {
        this.addService(InjectionService);
        this.addModule(new CoreEcsModule());
    }

    setWorld(world: World): this {
        this.assertMutable();
        this._world = world;
        return this;
    }

    addResource<T extends Resource>(type: ResourceType<T>, instance: T): this {
        this.assertMutable();
        const existing = this._resources.get(type);
        if (existing && existing !== instance) {
            throw new Error(`Resource already registered: ${type.name}`);
        }
        this._resources.set(type, instance);
        return this;
    }

    addState<T extends State>(type: StateType<T>): this {
        this.assertMutable();
        this._states.add(type);
        return this;
    }

    addService<T extends Service>(type: ServiceType<T>): this {
        this.assertMutable();
        this._services.add(type);
        return this;
    }

    addSystem<const Params extends readonly SystemParam[]>(
        stage: UpdateStage,
        fn: SystemFunction<Params>,
        params: Params,
        options: SystemOptions = {},
    ): SystemHandle {
        this.assertMutable();
        this.registerParams(params);
        return this._schedule.addSystem(stage, fn, params, options);
    }

    before(system: SystemHandle, target: SystemDependencyTarget): this {
        this.assertMutable();
        this._schedule.before(system, target);
        return this;
    }

    after(system: SystemHandle, target: SystemDependencyTarget): this {
        this.assertMutable();
        this._schedule.after(system, target);
        return this;
    }

    chain(...systems: readonly SystemHandle[]): this {
        this.assertMutable();
        this._schedule.chain(...systems);
        return this;
    }

    addModule(module: Module): this {
        this.assertMutable();
        if (this._modules.indexOf(module) !== -1) {
            throw new Error(`Module instance already registered: ${module.constructor.name}`);
        }
        this._modules.push(module);
        try {
            module.build(this);
        } catch (error) {
            this._modules.pop();
            throw error;
        }
        return this;
    }

    build(): Ecs {
        this.assertMutable();
        this._built = true;
        this.validateResources();

        const resources = new ResourceContainer();
        const states = new StateContainer();
        const services = new ServiceContainer();
        for (const [type, instance] of this._resources) resources.add(type, instance);
        for (const type of this._states) states.add(type);
        for (const type of this._services) services.add(type);
        resources.lock();
        states.lock();
        services.lock();

        const context: InjectionContext = {
            world: this._world,
            resources,
            states,
            services,
        };
        this._world.bind(context);
        const injection = services.get(InjectionService);
        injection.bind(context);
        for (const state of states.values()) injection.inject(state);
        for (const service of services.values()) injection.inject(service);

        const scheduler = new Scheduler(this._schedule.build());
        return new Ecs(
            this._world,
            resources,
            states,
            services,
            scheduler,
            Object.freeze([...this._modules]),
            context,
        );
    }

    private registerParams(params: readonly SystemParam[]): void {
        for (const param of params) {
            if (isMutParam(param)) {
                this.addState(param.target);
            } else if (param === World || param instanceof QueryType) {
                continue;
            } else if (param.prototype instanceof Resource) {
                this._requiredResources.add(param as ResourceType);
            } else if (param.prototype instanceof State) {
                this.addState(param as StateType);
            } else if (param.prototype instanceof Service) {
                this.addService(param as ServiceType);
            }
        }
    }

    private validateResources(): void {
        const missing = [...this._requiredResources]
            .filter(type => !this._resources.has(type))
            .map(type => type.name);
        if (missing.length) throw new Error(`Missing system Resources: ${missing.join(", ")}`);
    }

    private assertMutable(): void {
        if (this._built) throw new Error("EcsBuilder has already been built");
    }
}
