import { QueryType } from "../ecs/query/query-type";
import {
    ErrorHandlerService,
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
    systemMetadata,
    type DefinedSystem,
    type SystemDependencyTarget,
    type SystemHandle,
    type SystemOptions,
    type SystemParam,
    SystemScheduleBuilder,
} from "../schedule";
import { Ecs } from "./ecs";
import { ECS_CONSTRUCTION_TOKEN } from "./construction-token";
import type { Module } from "./module";

/**
 * ECS 的唯一构建入口。
 * 用于注册 World、三类容器对象、Module 和系统，调用 `build()` 后不可继续修改。
 */
export class EcsBuilder {
    private readonly _resources = new Map<ResourceType, Resource>();
    private readonly _states = new Set<StateType>();
    private readonly _services = new Set<ServiceType>();
    private readonly _requiredResources = new Set<ResourceType>();
    private readonly _schedule = new SystemScheduleBuilder();
    private readonly _modules: Module[] = [];
    private _world = new World();
    private _built = false;

    /** 创建 Builder，并自动安装核心 ECS 基础设施。 */
    constructor() {
        this.addService(InjectionService);
        this.addService(ErrorHandlerService);
        this.addModule(new CoreEcsModule());
    }

    /** 使用自定义 World 替换默认实例。 */
    setWorld(world: World): this {
        this.assertMutable();
        this._world = world;
        return this;
    }

    /** 注册一个构建前已经实例化的只读 Resource。 */
    addResource<T extends Resource>(type: ResourceType<T>, instance: T): this {
        this.assertMutable();
        const existing = this._resources.get(type);
        if (existing && existing !== instance) {
            throw new Error(`Resource already registered: ${type.name}`);
        }
        this._resources.set(type, instance);
        return this;
    }

    /** 注册由 ECS 实例化和管理生命周期的 State。 */
    addState<T extends State>(type: StateType<T>): this {
        this.assertMutable();
        this._states.add(type);
        return this;
    }

    /** 注册由 ECS 实例化和管理生命周期的 Service。 */
    addService<T extends Service>(type: ServiceType<T>): this {
        this.assertMutable();
        this._services.add(type);
        return this;
    }

    /**
     * 注册由 `defSystem()` 定义的系统函数。
     * @param system 已绑定 Stage 与参数元数据的系统函数。
     * @param options 可选的前后依赖规则。
     * @returns 注册后的系统句柄。
     */
    addSystem<const Params extends readonly SystemParam[]>(
        system: DefinedSystem<Params>,
        options: SystemOptions = {},
    ): SystemHandle {
        this.assertMutable();
        const { stage, params } = systemMetadata(system);
        this.registerParams(params);
        return this._schedule.addSystem(stage, system, params, options);
    }

    /** 声明 `system` 在 `target` 之前执行。 */
    before(system: SystemHandle, target: SystemDependencyTarget): this {
        this.assertMutable();
        this._schedule.before(system, target);
        return this;
    }

    /** 声明 `system` 在 `target` 之后执行。 */
    after(system: SystemHandle, target: SystemDependencyTarget): this {
        this.assertMutable();
        this._schedule.after(system, target);
        return this;
    }

    /** 按传入顺序串联同阶段系统。 */
    chain(...systems: readonly SystemHandle[]): this {
        this.assertMutable();
        this._schedule.chain(...systems);
        return this;
    }

    /** 注册并立即执行 Module 的 `build()`。 */
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

    /**
     * 完成容器、注入上下文和 Schedule 的构建。
     * @returns 尚未初始化的 ECS 实例。
     */
    build(): Ecs {
        this.assertMutable();
        this._built = true;
        this.validateResources();

        const resources = new ResourceContainer();
        const states = new StateContainer();
        const services = new ServiceContainer();
        for (const [type, instance] of this._resources) resources.set(type, instance);
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
        return Ecs.create(
            ECS_CONSTRUCTION_TOKEN,
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
