import { Container } from "../container";
import type { InjectionContext } from "../injection";
import { createInjectDecorator } from "../injection-metadata";
import type { Resource, ResourceType } from "../resource";
import type { State, StateType } from "../state";
import type {
    Service,
    ServiceActivateContext,
    ServiceInitContext,
    ServiceType,
} from "./types";


const ServiceSymob = Symbol("ServiceMetadata");
/** 创建并保存 Service，按注入依赖顺序管理其生命周期。 */
export class ServiceContainer extends Container<Service> {
    private context: InjectionContext | undefined;
    private readonly dynamicDependencies = new Map<Service, Set<Service>>();
    private readonly started: Service[] = [];

    constructor() {
        super(ServiceSymob);
    }
    /** @internal 绑定仅供当前 Ecs 使用的容器上下文。 */
    bind(context: InjectionContext): void {
        if (this.context && this.context !== context) {
            throw new Error("ServiceContainer is already bound to another InjectionContext");
        }
        this.context = context;
    }

    override init(): void {
        if (!this.context) throw new Error("ServiceContainer requires an InjectionContext");
        super.init();
    }

    protected doInit(order: Service[]): void {
        const context = this.context!;
        for (const value of order) {
            const scope = new InitContext(context);
            try { value.init?.(scope); }
            finally { scope.close(); }
        }
        for (const value of order) {
            const scope = new ActivateContext(context, value, this.dynamicDependencies);
            try { value.activate?.(scope); }
            finally { scope.close(); }
        }
        this.refreshLifecycleOrder(this.dynamicDependencies);
    }

    /** Startup System 完成后，按生命周期顺序开放全部 Service。 */
    start(): void {
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
    static inject<T extends Service>(type: ServiceType<T>) {
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

    service<T extends Service>(type: ServiceType<T>): T {
        this.assertActive();
        const dependency = this.context.services.get(type);
        if (dependency !== this.owner) {
            let entries = this.dependencies.get(this.owner);
            if (!entries) {
                entries = new Set();
                this.dependencies.set(this.owner, entries);
            }
            entries.add(dependency);
        }
        return dependency;
    }
}

