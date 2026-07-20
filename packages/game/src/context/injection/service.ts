import { Service } from "../service";

const flag = Symbol("InjectionFlag");
type ApplyInjection = (instance: object) => void;

/** 为运行时动态创建、且属于当前 Game 的辅助对象执行属性注入。 */
export class InjectionService extends Service {
    private _apply: ApplyInjection | undefined;

    constructor(apply: ApplyInjection) {
        super();
        this._apply = apply;
    }

    /**
     * 注入动态辅助对象，但不接管其生命周期。
     * 同一 Game 重复注入幂等，跨 Game 注入同一实例会报错。
     */
    inject<T extends object>(instance: T): T {
        const apply = this._apply;
        if (!apply) throw new Error("InjectionService has been disposed");
        const flagValue = (instance as any)[flag];
        if (flagValue !== undefined && flagValue !== this) {
            throw new Error(`${instance.constructor.name} was injected by another Game`);
        }
        if (flagValue === this) return instance;
        (instance as any)[flag] = this;
        apply(instance);
        return instance;
    }

    /** 解除对构造期注入能力的引用。 */
    dispose(): void {
        this._apply = undefined;
    }
}
