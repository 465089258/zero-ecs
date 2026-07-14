import {
    type InjectionContext,
    type Resource,
    ResourceContainer,
    type ResourceType,
    type Service,
    ServiceContainer,
    type ServiceType,
    type State,
    StateContainer,
    type StateType,
} from "../context";
import { World } from "../context/world";
import { Scheduler, Shutdown, Startup, Update } from "../schedule";
import { InternalPost } from "../schedule/internal-stage";
import { EcsPhase } from "./lifecycle";
import type { Module } from "./module";
import { ECS_CONSTRUCTION_TOKEN } from "./construction-token";

export { EcsPhase } from "./lifecycle";

/**
 * ECS 运行时的生命周期所有者。
 * World、三类容器、Scheduler 和 Modules 均由该实例统一协调。
 */
export class Ecs {
    private _phase = EcsPhase.Built;
    private _modulesDisposed = false;

    private constructor(
        token: typeof ECS_CONSTRUCTION_TOKEN,
        readonly world: World,
        private readonly _resources: ResourceContainer,
        private readonly _states: StateContainer,
        private readonly _services: ServiceContainer,
        private readonly _scheduler: Scheduler,
        readonly modules: readonly Module[],
        private readonly _context: InjectionContext,
    ) {
        if (token !== ECS_CONSTRUCTION_TOKEN) throw new TypeError("Ecs must be created by EcsBuilder");
    }

    /** @internal 仅供 EcsBuilder 构造实例。 */
    static create(
        token: typeof ECS_CONSTRUCTION_TOKEN,
        world: World,
        resources: ResourceContainer,
        states: StateContainer,
        services: ServiceContainer,
        scheduler: Scheduler,
        modules: readonly Module[],
        context: InjectionContext,
    ): Ecs {
        if (token !== ECS_CONSTRUCTION_TOKEN) throw new TypeError("Ecs must be created by EcsBuilder");
        return new Ecs(token, world, resources, states, services, scheduler, modules, context);
    }

    /** 当前生命周期阶段。 */
    get phase(): EcsPhase { return this._phase; }

    /** 按类型取得只读 Resource。 */
    readonly resource = <T extends Resource>(type: ResourceType<T>): Readonly<T> =>
        this._resources.get(type);

    /** 按类型取得只读 State。 */
    readonly state = <T extends State>(type: StateType<T>): Readonly<T> =>
        this._states.get(type);

    /** 按类型取得 Service。 */
    readonly service = <T extends Service>(type: ServiceType<T>): T =>
        this._services.get(type);

    /** 初始化 World、State、Service、Scheduler，再按注册顺序调用 `Module.init()`。 */
    init(): void {
        this.assertPhase(EcsPhase.Built, "init");
        try {
            this.world.init();
            this._states.init();
            this._services.init();
            this._scheduler.init(this._context);
            for (const module of this.modules) module.init?.(this);
            this._phase = EcsPhase.Initialized;
        } catch (error) {
            try { this.dispose(); } catch { /* preserve init error */ }
            throw error;
        }
    }

    /** 执行 Startup 系统，再按注册顺序调用 `Module.start()`。 */
    start(): void {
        this.assertPhase(EcsPhase.Initialized, "start");
        let lastStarted = -1;
        try {
            this._scheduler.run(Startup);
            for (let i = 0; i < this.modules.length; i++) {
                lastStarted = i;
                this.modules[i].start?.(this);
            }
            this._phase = EcsPhase.Running;
        } catch (error) {
            for (let i = lastStarted; i >= 0; i--) {
                try { this.modules[i].stop?.(this); } catch { /* preserve start error */ }
            }
            try { this._scheduler.run(Shutdown); } catch { /* preserve start error */ }
            this._phase = EcsPhase.Stopped;
            throw error;
        }
    }

    /** 执行一次完整固定 Tick，包括业务阶段和内部 Post。 */
    update(): void {
        this.assertPhase(EcsPhase.Running, "update");
        try {
            const stages = Update.stages;
            for (let i = 0; i < stages.length; i++) this._scheduler.run(stages[i]);
            const postStages = InternalPost.stages;
            for (let i = 0; i < postStages.length; i++) this._scheduler.run(postStages[i]);
        } catch (error) {
            // Tick 失败后立即停止，避免下一次更新在部分变更的 World 上重试延迟任务。
            try { this.stop(); } catch { /* preserve update error */ }
            throw error;
        }
    }

    /** 停止运行，逆序调用 Module.stop() 并执行 Shutdown 系统。 */
    stop(): void {
        if (this._phase !== EcsPhase.Running) return;
        let firstError: unknown;
        for (let i = this.modules.length - 1; i >= 0; i--) {
            try { this.modules[i].stop?.(this); }
            catch (error) { firstError ??= error; }
        }
        try { this._scheduler.run(Shutdown); }
        catch (error) { firstError ??= error; }
        this._phase = EcsPhase.Stopped;
        if (firstError !== undefined) throw firstError;
    }

    /** 按依赖逆序释放全部运行时对象；重复调用安全。 */
    dispose(): void {
        if (this._phase === EcsPhase.Disposed) return;
        let firstError: unknown;
        try { this.stop(); }
        catch (error) { firstError ??= error; }
        if (!this._modulesDisposed) {
            this._modulesDisposed = true;
            for (let i = this.modules.length - 1; i >= 0; i--) {
                try { this.modules[i].dispose?.(this); }
                catch (error) { firstError ??= error; }
            }
        }
        try { this._scheduler.dispose(); }
        catch (error) { firstError ??= error; }
        try { this._services.dispose(); }
        catch (error) { firstError ??= error; }
        try { this._states.dispose(); }
        catch (error) { firstError ??= error; }
        try { this.world.dispose(); }
        catch (error) { firstError ??= error; }
        try { this._resources.clear(); }
        catch (error) { firstError ??= error; }
        this._phase = EcsPhase.Disposed;
        if (firstError !== undefined) throw firstError;
    }

    private assertPhase(expected: EcsPhase, operation: string): void {
        if (this._phase !== expected) {
            throw new Error(`Ecs.${operation}() is invalid during phase ${EcsPhase[this._phase]}`);
        }
    }
}
