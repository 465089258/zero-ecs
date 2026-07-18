import { injectAll, type InjectionContext } from "./injection";
import { Service } from "./service";

const flag = Symbol("InjectionFlag");
/** 为运行时动态创建、且属于当前 ECS 的辅助对象执行属性注入。 */
export class InjectionService extends Service {
    // 运行时绑定例外：只定位当前 ECS 容器，不属于 World 的可恢复状态。
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
        const flagValue = (instance as any)[flag];
        if (flagValue !== undefined && flagValue !== this) {
            throw new Error(`${instance.constructor.name} was injected by another Ecs`);
        }
        if (flagValue === this) return instance;
        (instance as any)[flag] = this;
        const context = this.context;
        injectAll(instance, context);
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
