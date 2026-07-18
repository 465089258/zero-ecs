import {
    createWorldInjectDecorator,
    type InjectionContext,
} from "./injection";
import type { Resource, ResourceType } from "./resource";
import type { Service, ServiceType } from "./service";
import type { State, StateType } from "./state";


/**
 * 当前 ECS 实例的底层访问入口。
 * World 与 Resource、State、Service 同级，不持有 Scheduler。
 */
export class World {
    private _context: InjectionContext | undefined;

    /** 声明一个 World 属性注入。 */
    static inject() { return createWorldInjectDecorator(); }

    /** @internal 由 EcsBuilder 在 `Ecs.init()` 前绑定一次。 */
    bind(context: InjectionContext): void {
        if (this._context) throw new Error("World has already been bound");
        if (context.world !== this) throw new Error("World injection context mismatch");
        this._context = context;
    }

    /** 获取只读 Resource 实例。 */
    resource<T extends Resource>(type: ResourceType<T>): Readonly<T> {
        return this.context.resources.get<T>(type);
    }

    /** 获取只读 State 实例。 */
    state<T extends State>(type: StateType<T>): Readonly<T> {
        return this.context.states.get<T>(type);
    }

    /** 获取 Service 实例。 */
    service<T extends Service>(type: ServiceType<T>): T {
        return this.context.services.get<T>(type);
    }

    /** World 初始化钩子，子类可覆盖。 */
    init(): void { }
    /** 解除 World 与当前 ECS 上下文的绑定。 */
    dispose(): void { this._context = undefined; }

    private get context(): InjectionContext {
        if (!this._context) throw new Error("World has not been bound");
        return this._context;
    }
}
