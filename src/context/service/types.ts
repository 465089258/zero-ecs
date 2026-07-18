import { ClassType } from "../container";
import type { Resource, ResourceType } from "../resource";
import type { State, StateType } from "../state";
import { ServiceContainer } from "./service-container";

/** Service 子类的无参构造类型。 */
export type ServiceType<T extends Service = Service> = ClassType<T>;

declare const ServiceBrand: unique symbol;

/** Service 自身初始化阶段可使用的一次性只读上下文。 */
export interface ServiceInitContext {
    /** 获取构建期提供的只读 Resource。 */
    resource<T extends Resource>(type: ResourceType<T>): Readonly<T>;
    /** 获取已经初始化的只读 State。 */
    state<T extends State>(type: StateType<T>): Readonly<T>;
}

/** 所有 Service 完成初始化后，用于建立跨 Service 连接的一次性上下文。 */
export interface ServiceActivateContext extends ServiceInitContext {
    /** 获取已经完成 init 的 Service，并记录当前 Service 对它的生命周期依赖。 */
    service<T extends Service>(type: ServiceType<T>): T;
}

/**
 * 围绕 State 提供主动操作、查询和算法的可注入方法容器。
 * Service 原则上不持有 World 可变数据，也不包含逐帧更新入口；
 * 由 Stage 驱动的逻辑必须直接注册为 System。
 */
export abstract class Service {
    protected declare readonly [ServiceBrand]: void;
    /** 声明一个 Service 属性注入。 */
    static readonly inject = ServiceContainer.inject;
    /** 初始化自身；此阶段不调用其他 Service。 */
    init?(context: ServiceInitContext): void;
    /** 所有 Service 完成 init 后建立跨 Service 连接。 */
    activate?(context: ServiceActivateContext): void;
    /** Startup System 完成后开放宿主事件、Worker 等外部输入。 */
    start?(): void;
    /** 停止宿主事件、Worker 等外部输入。 */
    stop?(): void;
    /** 可选释放钩子；按初始化逆序调用。 */
    dispose?(): void;
}
