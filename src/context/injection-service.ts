import { injectAll, type InjectionContext } from "./injection";
import { Service } from "./types";

const owners = new WeakMap<object, InjectionService>();

/** Injects dependencies into runtime-created helpers owned by one Ecs. */
export class InjectionService extends Service {
    private _context: InjectionContext | undefined;

    /** @internal Bound once by EcsBuilder before initial object injection. */
    bind(context: InjectionContext): void {
        if (this._context) throw new Error("InjectionService has already been bound");
        if (context.services.get(InjectionService) !== this) {
            throw new Error("InjectionService context mismatch");
        }
        this._context = context;
    }

    /**
     * Injects a runtime-created helper without taking ownership of its lifecycle.
     * Repeating the operation in the same Ecs is idempotent.
     */
    inject<T extends object>(instance: T): T {
        const context = this.context;
        const owner = owners.get(instance);
        if (owner === this) return instance;
        if (owner !== undefined) {
            throw new Error(`${instance.constructor.name} was injected by another Ecs`);
        }
        injectAll(instance, context);
        owners.set(instance, this);
        return instance;
    }

    dispose(): void {
        this._context = undefined;
    }

    private get context(): InjectionContext {
        if (!this._context) throw new Error("InjectionService has not been bound");
        return this._context;
    }
}
