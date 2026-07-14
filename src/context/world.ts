import {
    createWorldInjectDecorator,
    type InjectionContext,
} from "./injection";
import {
    type Resource,
    type ResourceType,
    type Service,
    type ServiceType,
    type State,
    type StateType,
} from "./types";

/**
 * Per-Ecs low-level interface. World is a peer of Resource, State and Service;
 * it does not own the scheduler.
 */
export class World {
    private _context: InjectionContext | undefined;

    static inject() { return createWorldInjectDecorator(); }

    /** @internal Bound once by EcsBuilder before Ecs.init(). */
    bind(context: InjectionContext): void {
        if (this._context) throw new Error("World has already been bound");
        if (context.world !== this) throw new Error("World injection context mismatch");
        this._context = context;
    }

    resource<T extends Resource>(type: ResourceType<T>): Readonly<T> {
        return this.context.resources.get(type);
    }

    state<T extends State>(type: StateType<T>): Readonly<T> {
        return this.context.states.get(type);
    }

    service<T extends Service>(type: ServiceType<T>): T {
        return this.context.services.get(type);
    }

    init(): void {}
    dispose(): void { this._context = undefined; }

    private get context(): InjectionContext {
        if (!this._context) throw new Error("World has not been bound");
        return this._context;
    }
}
