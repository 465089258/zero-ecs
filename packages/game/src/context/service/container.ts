import { Container } from "../container";
import type { InjectionContext } from "../injection/injection";
import { createInjectDecorator } from "../injection/metadata";
import type { Resource, ResourceType } from "../resource";
import type { State, StateType } from "../state";
import type {
    Service,
    ServiceActivateContext,
    ServiceInitContext,
    ServiceToken,
} from "./types";


const ServiceSymob = Symbol("ServiceMetadata");
/** 创建并保存 Service，按注入依赖顺序管理其生命周期。 */
export class ServiceContainer extends Container<Service> {
    private context: InjectionContext | undefined;
    private readonly dynamicDependencies = new Map<Service, Set<Service>>();
    private readonly started: Service[] = [];
    private servicesInitialized = false;

    constructor() {
        super(ServiceSymob);
    }
    /** @internal 绑定仅供当前 Game 使用的容器上下文。 */
    bind(context: InjectionContext): void {
        if (this.context && this.context !== context) {
            throw new Error("ServiceContainer is already bound to another InjectionContext");
        }
        this.context = context;
    }

    override init(): void {
        this.initServices();
        this.activateServices();
    }

    /** @internal 执行全部 Service.init，建立 World attach 前的初始化屏障。 */
    initServices(): void {
        if (this.servicesInitialized) return;
        if (!this.context) throw new Error("ServiceContainer requires an InjectionContext");
        this.refreshLifecycleOrder();
        const order = this.lifecycleOrder;
        const context = this.context!;
        for (const value of order) {
            const scope = new InitContext(context);
            try { value.init?.(scope); }
            finally { scope.close(); }
        }
        this.servicesInitialized = true;
    }

    /** @internal 在 World attach 后执行全部 Service.activate。 */
    activateServices(): void {
        if (this.initialized) return;
        if (!this.servicesInitialized || !this.context) {
            throw new Error("ServiceContainer services have not been initialized");
        }
        const context = this.context;
        const order = this.lifecycleOrder;
        for (const value of order) {
            const scope = new ActivateContext(context, value, this.dynamicDependencies);
            try { value.activate?.(scope); }
            finally { scope.close(); }
        }
        this.refreshLifecycleOrder(this.dynamicDependencies);
        this.initialized = true;
    }

    /** 按生命周期顺序使全部 Service 进入运行状态。 */
    start(): void {
        if (!this.initialized) throw new Error("ServiceContainer has not been activated");
        if (this.started.length > 0) return;
        try {
            for (const value of this.lifecycleOrder) {
                this.started.push(value);
                value.start?.();
            }
        } catch (error) {
            try { this.stop(); } catch { /* preserve start error */ }
            throw error;
        }
    }

    /** 按启动逆序停止全部 Service，并继续执行剩余 stop。 */
    stop(): void {
        let firstError: unknown;
        for (let i = this.started.length - 1; i >= 0; i--) {
            try { this.started[i].stop?.(); }
            catch (error) { firstError ??= error; }
        }
        this.started.length = 0;
        if (firstError !== undefined) throw firstError;
    }

    protected doDispose(order: Service[]) {
        let firstError: unknown;
        try { this.stop(); }
        catch (error) { firstError ??= error; }
        for (let i = order.length - 1; i >= 0; i--) {
            try { order[i].dispose?.(); }
            catch (error) { firstError ??= error; }
        }
        this.dynamicDependencies.clear();
        this.context = undefined;
        if (firstError !== undefined) throw firstError;
    }

    override dispose(): void {
        try { super.dispose(); }
        finally { this.servicesInitialized = false; }
    }
    static inject<T extends Service>(type: ServiceToken<T>) {
        return createInjectDecorator(ServiceSymob, type);
    }
}

class InitContext implements ServiceInitContext {
    private active = true;

    constructor(protected readonly context: InjectionContext) {}

    resource<T extends Resource>(type: ResourceType<T>): Readonly<T> {
        this.assertActive();
        return this.context.resources.get(type);
    }

    state<T extends State>(type: StateType<T>): Readonly<T> {
        this.assertActive();
        return this.context.states.get(type);
    }

    close(): void { this.active = false; }

    protected assertActive(): void {
        if (!this.active) throw new Error("Service lifecycle context is no longer active");
    }
}

class ActivateContext extends InitContext implements ServiceActivateContext {
    constructor(
        context: InjectionContext,
        private readonly owner: Service,
        private readonly dependencies: Map<Service, Set<Service>>,
    ) { super(context); }

    service<T extends Service>(type: ServiceToken<T>): T {
        this.assertActive();
        const dependency = this.context.services.get(type);
        this.recordDependency(dependency);
        return dependency;
    }

    private recordDependency(dependency: Service): void {
        if (dependency !== this.owner) {
            let entries = this.dependencies.get(this.owner);
            if (!entries) {
                entries = new Set();
                this.dependencies.set(this.owner, entries);
            }
            entries.add(dependency);
        }
    }
}
