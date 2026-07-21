import {
    Allocator,
    type ComponentType,
    type IAllocator,
    type QueryProjection,
    World,
} from "@zero-ecs/world";
import { registerQueryProjection } from "@zero-ecs/world/game-bridge";
import { ErrorHandlerService } from "../context/error-handler-service";
import { injectAll, type InjectionContext } from "../context/injection/injection";
import { InjectionService } from "../context/injection/service";
import {
    Resource,
    ResourceContainer,
    type ResourceType,
    Service,
    ServiceContainer,
    type ServiceToken,
    type ServiceType,
    State,
    StateContainer,
    type StateType,
} from "../context";
import { AllocatorService } from "../memory/allocator-service";
import { ObjectPoolService } from "../pool/object-pool-service";
import {
    ScheduleBuilder,
    Scheduler,
    type SystemDependencyTarget,
    type SystemHandle,
    type SystemOptions,
} from "@zero-ecs/scheduler";
import { GAME_CONSTRUCTION_TOKEN } from "./construction-token";
import { Game } from "./game";
import { GameSystemParamResolver } from "./game-system-param-resolver";
import type { Module } from "./module";
import { allocatorOf, claimWorld, finalizeWorld } from "./world-ownership";
import {
    systemMetadata,
    type DefinedSystem,
    type SystemParam,
    validateSystemParams,
} from "./system";

/**
 * Game 的唯一构建入口。
 * 用于注册 World、三类容器对象、Module 和系统，调用 `build()` 后不可继续修改。
 */
export class GameBuilder {
    private readonly _resources = new Map<ResourceType, Resource>();
    private readonly _states = new Set<StateType>();
    private readonly _services = new Map<ServiceToken, ServiceRegistration>();
    private readonly _queryProjections = new Map<QueryProjection, ComponentType>();
    private readonly _schedule = new ScheduleBuilder<SystemParam>();
    private readonly _modules: Module[] = [];
    private _world: World | undefined;
    private _allocator: IAllocator | undefined;
    private _built = false;
    private _failed = false;

    /** 使用自定义 World 替换默认实例。 */
    setWorld(world: World): this {
        return this.modify(() => {
            if (this._allocator) throw new Error("Cannot set World after configuring an allocator");
            this._world = world;
            return this;
        });
    }

    /** 为 Builder 创建的默认 World 指定外部 IAllocator。 */
    setAllocator(allocator: IAllocator): this {
        return this.modify(() => {
            if (this._world) throw new Error("Cannot configure an allocator after setting a World");
            this._allocator = allocator;
            return this;
        });
    }

    /** 将只读 Query 投影绑定到只在组合层可见的实际存储组件。 */
    addQueryProjection<T extends object>(
        projection: QueryProjection<T>,
        storage: ComponentType<T>,
    ): this {
        return this.modify(() => {
            const existing = this._queryProjections.get(projection);
            if (existing && existing !== storage) {
                throw new Error(`Query projection already registered: ${projection.name}`);
            }
            this._queryProjections.set(projection, storage);
            return this;
        });
    }

    /** 注册一个构建前已经实例化的只读 Resource。 */
    addResource<T extends Resource>(type: ResourceType<T>, instance: T): this {
        return this.modify(() => {
            const existing = this._resources.get(type);
            if (existing && existing !== instance) {
                throw new Error(`Resource already registered: ${type.name}`);
            }
            this._resources.set(type, instance);
            return this;
        });
    }

    /** 注册由 Game 实例化和管理生命周期的 State。 */
    addState<T extends State>(type: StateType<T>): this {
        return this.modify(() => {
            this._states.add(type);
            return this;
        });
    }

    /**
     * 注册由 Game 实例化和管理生命周期的 Service。
     * 子类会沿原型链覆盖已经注册的父类 Service token。
     */
    addService<T extends Service>(type: ServiceType<T>): this {
        return this.modify(() => {
            this._services.set(type, { kind: "type", type });
            return this;
        });
    }

    /** 使用已有实例覆盖或注册一个 Service token。 */
    setService<T extends Service>(type: ServiceToken<T>, instance: T): this {
        return this.modify(() => {
            this._services.set(type, { kind: "instance", type, instance });
            return this;
        });
    }

    /** 使用只在 build 冷路径调用一次的工厂覆盖或注册 Service token。 */
    setServiceFactory<T extends Service>(
        type: ServiceToken<T>,
        factory: (context: Readonly<ServiceBuildContext>) => T,
    ): this {
        return this.modify(() => {
            this._services.set(type, { kind: "factory", type, factory });
            return this;
        });
    }

    /** 注册由 `defSystem()` 定义的系统函数。 */
    addSystem<const Params extends readonly SystemParam[]>(
        system: DefinedSystem<Params>,
        options: SystemOptions = {},
    ): SystemHandle {
        return this.modify(() => {
            const { stage, params } = systemMetadata(system);
            validateSystemParams(params);
            return this._schedule.addSystem(stage, system, params, options);
        });
    }

    /** 声明 `system` 在 `target` 之前执行。 */
    before(system: SystemHandle, target: SystemDependencyTarget): this {
        return this.modify(() => {
            this._schedule.before(system, target);
            return this;
        });
    }

    /** 声明 `system` 在 `target` 之后执行。 */
    after(system: SystemHandle, target: SystemDependencyTarget): this {
        return this.modify(() => {
            this._schedule.after(system, target);
            return this;
        });
    }

    /** 目标系统已注册时，声明 `system` 在其之前执行。 */
    beforeIfPresent(system: SystemHandle, target: SystemDependencyTarget): this {
        return this.modify(() => {
            this._schedule.beforeIfPresent(system, target);
            return this;
        });
    }

    /** 目标系统已注册时，声明 `system` 在其之后执行。 */
    afterIfPresent(system: SystemHandle, target: SystemDependencyTarget): this {
        return this.modify(() => {
            this._schedule.afterIfPresent(system, target);
            return this;
        });
    }

    /** 按传入顺序串联同阶段系统。 */
    chain(...systems: readonly SystemHandle[]): this {
        return this.modify(() => {
            this._schedule.chain(...systems);
            return this;
        });
    }

    /** 注册并立即执行 Module 的 `build()`。 */
    addModule(module: Module): this {
        return this.modify(() => {
            if (this._modules.indexOf(module) !== -1) {
                throw new Error(`Module instance already registered: ${module.constructor.name}`);
            }
            this._modules.push(module);
            module.build(this);
            return this;
        });
    }

    /** 完成容器、注入上下文和 Schedule 的构建。 */
    build(): Game {
        this.assertMutable();
        this._built = true;

        const ownedAllocator = this._world === undefined && this._allocator === undefined
            ? new Allocator()
            : undefined;
        const world = this._world ?? new World(this._allocator ?? ownedAllocator!);
        const owner = Symbol("GameWorldOwner");
        claimWorld(world, owner);
        try {
            for (const [projection, storage] of this._queryProjections) {
                registerQueryProjection(world, projection, storage);
            }
            const resources = new ResourceContainer();
            const states = new StateContainer();
            const services = new ServiceContainer();
            const context: InjectionContext = {
                world,
                resources,
                states,
                services,
            };
            const applyInjection = (instance: object) => injectAll(instance, context);
            const allocator = allocatorOf(world);
            services.set(InjectionService, new InjectionService(applyInjection));
            services.set(ErrorHandlerService, new ErrorHandlerService());
            services.set(AllocatorService, new AllocatorService(allocator));
            services.set(ObjectPoolService, new ObjectPoolService());
            for (const [type, instance] of this._resources) resources.set(type, instance);
            for (const type of this._states) states.add(type);
            const serviceBuildContext: ServiceBuildContext = {
                world,
                worldAllocator: allocator,
            };
            for (const registration of this._services.values()) {
                if (registration.kind === "type") services.add(registration.type);
                else if (registration.kind === "instance") {
                    services.set(registration.type, registration.instance);
                } else {
                    services.set(registration.type, registration.factory(serviceBuildContext));
                }
            }
            resources.lock();
            states.lock();
            services.lock();
            services.bind(context);
            const injection = services.get(InjectionService);
            for (const state of states.values()) injection.inject(state);
            for (const service of services.values()) injection.inject(service);

            const scheduler = new Scheduler(this._schedule.build());
            const params = new GameSystemParamResolver(context);
            return Game.create(
                GAME_CONSTRUCTION_TOKEN,
                world,
                owner,
                ownedAllocator,
                resources,
                states,
                services,
                scheduler,
                params,
                Object.freeze([...this._modules]),
            );
        } catch (error) {
            try { finalizeWorld(world, owner); }
            finally {
                if (ownedAllocator) {
                    ownedAllocator.trim();
                    ownedAllocator.clear();
                }
            }
            throw error;
        }
    }

    private assertMutable(): void {
        if (this._failed) throw new Error("GameBuilder cannot be reused after a build error");
        if (this._built) throw new Error("GameBuilder has already been built");
    }

    private modify<T>(operation: () => T): T {
        this.assertMutable();
        try { return operation(); }
        catch (error) {
            this._failed = true;
            throw error;
        }
    }
}

/** Service 工厂在 Game 构建冷路径可读取的最小上下文。 */
export interface ServiceBuildContext {
    readonly world: World;
    readonly worldAllocator: IAllocator;
}

type ServiceRegistration =
    | { readonly kind: "type"; readonly type: ServiceType }
    | { readonly kind: "instance"; readonly type: ServiceToken; readonly instance: Service }
    | {
        readonly kind: "factory";
        readonly type: ServiceToken;
        readonly factory: (context: Readonly<ServiceBuildContext>) => Service;
    };
