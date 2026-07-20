import { ClassType } from "../container";
import { StateContainer } from "./container";
/** State 子类的无参构造类型。 */
export type StateType<T extends State = State> = ClassType<T>;

declare const StateBrand: unique symbol;

/**
 * ECS 持有的可变数据对象；业务行为应放在 Service 或 System。
 * 系统默认以浅只读类型接收 State，使用 `Write(StateType)` 声明写访问。
 * 该声明用于调度元数据，不提供运行时隔离或深层不可变保证。
 * State 身份不表示字段会被持久化；未来由显式序列化元数据选择字段。
 */
export abstract class State {
    protected declare readonly [StateBrand]: void;
    /** 声明一个 State 属性注入。 */
    static readonly inject = StateContainer.inject;
    /** 可选初始化钩子；按 State 注入依赖的拓扑顺序调用。 */
    init?(): void;
    /** 可选释放钩子；按初始化逆序调用。 */
    dispose?(): void;
}

