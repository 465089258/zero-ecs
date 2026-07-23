import {
    type Resource,
    ResourceContainer,
    type ResourceType,
    type Service,
    ServiceContainer,
    type ServiceToken,
    type State,
    StateContainer,
    type StateType,
} from "../context";
import { type Allocator, World } from "@zero-ecs/world";
import { Scheduler, type SystemParamProvider } from "@zero-ecs/scheduler";
import { GAME_CONSTRUCTION_TOKEN } from "./construction-token";
import { GamePhase } from "./lifecycle";
import { type ManualStage, Shutdown, Startup, Update } from "./stage";
import type { SystemParam } from "./system";
import { finalizeWorld } from "./world-ownership";
import { GAME_SCHEDULER } from "./game-control";

export { GamePhase } from "./lifecycle";

/**
 * ECS 模拟的组合根和运行时实例。
 * Game 协调 World、容器与 Scheduler 的构建后生命周期。
 */
export class Game {
    private _phase = GamePhase.Built;
    private _worldFinalized = false;
    private _ownedAllocatorDisposed = false;

    private constructor(
        token: typeof GAME_CONSTRUCTION_TOKEN,
        private readonly _world: World,
        private readonly _worldOwner: symbol,
        private readonly _ownedAllocator: Allocator | undefined,
        private readonly _resources: ResourceContainer,
        private readonly _states: StateContainer,
        private readonly _services: ServiceContainer,
        private readonly _scheduler: Scheduler<SystemParam>,
        private readonly _params: SystemParamProvider<SystemParam>,
    ) {
        if (token !== GAME_CONSTRUCTION_TOKEN) {
            throw new TypeError("Game must be created by GameBuilder");
        }
    }

    /** @internal 仅供 GameBuilder 构造实例。 */
    static create(
        token: typeof GAME_CONSTRUCTION_TOKEN,
        world: World,
        worldOwner: symbol,
        ownedAllocator: Allocator | undefined,
        resources: ResourceContainer,
        states: StateContainer,
        services: ServiceContainer,
        scheduler: Scheduler<SystemParam>,
        params: SystemParamProvider<SystemParam>,
    ): Game {
        if (token !== GAME_CONSTRUCTION_TOKEN) {
            throw new TypeError("Game must be created by GameBuilder");
        }
        return new Game(
            token,
            world,
            worldOwner,
            ownedAllocator,
            resources,
            states,
            services,
            scheduler,
            params,
        );
    }

    /** 当前生命周期阶段。 */
    get phase(): GamePhase { return this._phase; }

    /**
     * 底层 ECS 数据内核。
     * 直接调用即时结构 API 时，调用方负责保证当前没有冲突的迭代或结构修改。
     */
    get world(): World { return this._world; }

    /** 按类型取得只读 Resource。 */
    readonly resource = <T extends Resource>(type: ResourceType<T>): Readonly<T> =>
        this._resources.get(type);

    /** 按类型取得只读 State。 */
    readonly state = <T extends State>(type: StateType<T>): Readonly<T> =>
        this._states.get(type);

    /** 按类型取得 Service。 */
    readonly service = <T extends Service>(type: ServiceToken<T>): T =>
        this._services.get(type);

    /** @internal 返回仅属于当前 Game 的 Scheduler。 */
    [GAME_SCHEDULER](): Scheduler<SystemParam> { return this._scheduler; }

    /**
     * 初始化 State、Service 和 Scheduler；World 在构造时已经可用。
     */
    init(): void {
        this.assertPhase(GamePhase.Built, "init");
        try {
            this._states.init();
            this._services.initServices();
            this._services.activateServices();
            this._scheduler.init();
            this._phase = GamePhase.Initialized;
        } catch (error) {
            try { this.dispose(); } catch { /* preserve init error */ }
            throw error;
        }
    }

    /** 事务式准备系统参数，启动全部 Service，再执行 Startup。 */
    start(): void {
        this.assertPhase(GamePhase.Initialized, "start");
        this._phase = GamePhase.Starting;
        try {
            this._scheduler.prepare(this._params);
        } catch (error) {
            this._phase = GamePhase.StartFailed;
            throw error;
        }

        try {
            this._services.start();
        } catch (error) {
            this._phase = GamePhase.Stopped;
            throw error;
        }

        try {
            this._scheduler.run(Startup);
            this._phase = GamePhase.Running;
        } catch (error) {
            this._phase = GamePhase.Stopping;
            try { this._scheduler.run(Shutdown); } catch { /* preserve start error */ }
            try { this._services.stop(); } catch { /* preserve start error */ }
            this._phase = GamePhase.Stopped;
            throw error;
        }
    }

    /** 执行一次完整固定 Tick，包括 Update.post 提交阶段。 */
    update(): void {
        this.assertPhase(GamePhase.Running, "update");
        try {
            const stages = Update.stages;
            for (let i = 0; i < stages.length; i++) this._scheduler.run(stages[i]);
        } catch (error) {
            try { this.stop(); } catch { /* preserve update error */ }
            throw error;
        }
    }

    /** 执行一次由宿主显式驱动的扩展阶段。 */
    runStage(stage: ManualStage): void {
        this.assertPhase(GamePhase.Running, "runStage");
        try {
            this._scheduler.run(stage);
        } catch (error) {
            try { this.stop(); } catch { /* preserve stage error */ }
            throw error;
        }
    }

    /** 执行 Shutdown，再按依赖逆序停止全部 Service。 */
    stop(): void {
        if (this._phase !== GamePhase.Running) return;
        this._phase = GamePhase.Stopping;
        let firstError: unknown;
        try { this._scheduler.run(Shutdown); }
        catch (error) { firstError ??= error; }
        try { this._services.stop(); }
        catch (error) { firstError ??= error; }
        this._phase = GamePhase.Stopped;
        if (firstError !== undefined) throw firstError;
    }

    /** 按依赖逆序释放全部运行时对象；重复调用安全。 */
    dispose(): void {
        if (this._phase === GamePhase.Disposed) return;
        if (this._phase === GamePhase.Starting || this._phase === GamePhase.Stopping) {
            throw new Error(`Game.dispose() is invalid during phase ${GamePhase[this._phase]}`);
        }
        let firstError: unknown;
        try { this.stop(); }
        catch (error) { firstError ??= error; }
        try { this._scheduler.dispose(); }
        catch (error) { firstError ??= error; }

        try { this._services.dispose(); }
        catch (error) { firstError ??= error; }
        try { this._states.dispose(); }
        catch (error) { firstError ??= error; }
        if (!this._worldFinalized) {
            try { finalizeWorld(this._world, this._worldOwner); }
            catch (error) { firstError ??= error; }
            this._worldFinalized = true;
        }
        if (!this._ownedAllocatorDisposed && this._ownedAllocator) {
            try {
                this._ownedAllocator.trim();
                this._ownedAllocator.clear();
            } catch (error) {
                firstError ??= error;
            }
            this._ownedAllocatorDisposed = true;
        }
        try { this._resources.dispose(); }
        catch (error) { firstError ??= error; }
        this._phase = GamePhase.Disposed;
        if (firstError !== undefined) throw firstError;
    }

    private assertPhase(expected: GamePhase, operation: string): void {
        if (this._phase !== expected) {
            throw new Error(`Game.${operation}() is invalid during phase ${GamePhase[this._phase]}`);
        }
    }
}
