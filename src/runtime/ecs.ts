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

export { EcsPhase } from "./lifecycle";

/** Runtime owner. World, containers, Scheduler and Modules are peers under Ecs. */
export class Ecs {
    private _phase = EcsPhase.Built;
    private _modulesDisposed = false;

    constructor(
        readonly world: World,
        readonly resources: ResourceContainer,
        readonly states: StateContainer,
        readonly services: ServiceContainer,
        readonly scheduler: Scheduler,
        readonly modules: readonly Module[],
        private readonly _context: InjectionContext,
    ) {}

    get phase(): EcsPhase { return this._phase; }

    readonly resource = <T extends Resource>(type: ResourceType<T>): T =>
        this.resources.get(type);

    readonly state = <T extends State>(type: StateType<T>): Readonly<T> =>
        this.states.get(type);

    readonly service = <T extends Service>(type: ServiceType<T>): T =>
        this.services.get(type);

    /** Structural initialization followed by Module.init() in registration order. */
    init(): void {
        this.assertPhase(EcsPhase.Built, "init");
        try {
            this.world.init();
            this.states.init();
            this.services.init();
            this.scheduler.init(this._context);
            for (const module of this.modules) module.init?.(this);
            this._phase = EcsPhase.Initialized;
        } catch (error) {
            try { this.dispose(); } catch { /* preserve init error */ }
            throw error;
        }
    }

    /** Runs Startup systems, then Module.start() in registration order. */
    start(): void {
        this.assertPhase(EcsPhase.Initialized, "start");
        let lastStarted = -1;
        try {
            this.scheduler.run(Startup);
            for (let i = 0; i < this.modules.length; i++) {
                lastStarted = i;
                this.modules[i].start?.(this);
            }
            this._phase = EcsPhase.Running;
        } catch (error) {
            for (let i = lastStarted; i >= 0; i--) {
                try { this.modules[i].stop?.(this); } catch { /* preserve start error */ }
            }
            try { this.scheduler.run(Shutdown); } catch { /* preserve start error */ }
            this._phase = EcsPhase.Stopped;
            throw error;
        }
    }

    /** Runs systems only. Services have no frame update lifecycle. */
    update(): void {
        this.assertPhase(EcsPhase.Running, "update");
        const stages = Update.stages;
        for (let i = 0; i < stages.length; i++) this.scheduler.run(stages[i]);
        const postStages = InternalPost.stages;
        for (let i = 0; i < postStages.length; i++) this.scheduler.run(postStages[i]);
    }

    stop(): void {
        if (this._phase !== EcsPhase.Running) return;
        let firstError: unknown;
        for (let i = this.modules.length - 1; i >= 0; i--) {
            try { this.modules[i].stop?.(this); }
            catch (error) { firstError ??= error; }
        }
        try { this.scheduler.run(Shutdown); }
        catch (error) { firstError ??= error; }
        this._phase = EcsPhase.Stopped;
        if (firstError !== undefined) throw firstError;
    }

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
        try { this.scheduler.dispose(); }
        catch (error) { firstError ??= error; }
        try { this.services.dispose(); }
        catch (error) { firstError ??= error; }
        try { this.states.dispose(); }
        catch (error) { firstError ??= error; }
        try { this.world.dispose(); }
        catch (error) { firstError ??= error; }
        try { this.resources.clear(); }
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
