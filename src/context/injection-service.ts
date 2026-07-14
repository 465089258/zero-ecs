import { injectAll, type InjectionContext } from "./injection";
import { Service } from "./types";

const owners = new WeakMap<object, InjectionService>();

/** 为运行时动态创建、且属于当前 ECS 的辅助对象执行属性注入。 */
export class InjectionService extends Service {
    private _context: InjectionContext | undefined;

    /** @internal 在首次注入前由 EcsBuilder 绑定一次。 */
    bind(context: InjectionContext): void {
        if (this._context) throw new Error("InjectionService has already been bound");
        if (context.services.get(InjectionService) !== this) {
            throw new Error("InjectionService context mismatch");
        }
        this._context = context;
    }

    /**
     * 注入动态辅助对象，但不接管其生命周期。
     * 同一 ECS 重复注入幂等，跨 ECS 注入同一实例会报错。
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

    /** 解除注入上下文绑定。 */
    dispose(): void {
        this._context = undefined;
    }

    private get context(): InjectionContext {
        if (!this._context) throw new Error("InjectionService has not been bound");
        return this._context;
    }
}
