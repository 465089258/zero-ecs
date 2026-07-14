import { createInjectDecorator, InjectionKind } from "./injection-metadata";

/** Resource 子类的构造类型。 */
export type ResourceType<T extends Resource = Resource> = abstract new (...args: any[]) => T;
/** State 子类的无参构造类型。 */
export type StateType<T extends State = State> = new () => T;
/** Service 子类的无参构造类型。 */
export type ServiceType<T extends Service = Service> = new () => T;

declare const ResourceBrand: unique symbol;
declare const StateBrand: unique symbol;
declare const ServiceBrand: unique symbol;

/**
 * 构建阶段传入、运行期间只读的静态资源。
 * Resource 不参与初始化和销毁生命周期。
 */
export abstract class Resource {
    protected declare readonly [ResourceBrand]: void;
    /** 声明一个 Resource 属性注入。 */
    static inject<T extends Resource>(type: ResourceType<T>) {
        return createInjectDecorator(InjectionKind.Resource, type);
    }
}

/**
 * ECS 持有的纯状态对象。
 * 系统默认以只读方式接收 State，使用 `Write(StateType)` 才能声明可写访问。
 */
export abstract class State {
    protected declare readonly [StateBrand]: void;
    /** 声明一个 State 属性注入。 */
    static inject<T extends State>(type: StateType<T>) {
        return createInjectDecorator(InjectionKind.State, type);
    }
    /** 可选初始化钩子；按 State 注入依赖的拓扑顺序调用。 */
    init?(): void;
    /** 可选释放钩子；按初始化逆序调用。 */
    dispose?(): void;
}

/**
 * 可注入的功能集合。
 * Service 本身不包含逐帧更新入口，运行逻辑应注册为系统函数。
 */
export abstract class Service {
    protected declare readonly [ServiceBrand]: void;
    /** 声明一个 Service 属性注入。 */
    static inject<T extends Service>(type: ServiceType<T>) {
        return createInjectDecorator(InjectionKind.Service, type);
    }
    /** 可选初始化钩子；按 Service 注入依赖的拓扑顺序调用。 */
    init?(): void;
    /** 可选释放钩子；按初始化逆序调用。 */
    dispose?(): void;
}
