import type { QueryComponentTuple } from "../ecs/query/filter";
import { Query } from "../ecs/query/query";
import { QueryType } from "../ecs/query/query-type";
import type { ResourceType, ServiceType, StateType } from "../context/types";
import { State } from "../context/types";
import { World } from "../context/world";
import type { UpdateStage } from "./stage";

declare const SystemIdBrand: unique symbol;
declare const MutBrand: unique symbol;
const MUT_PARAM = Symbol("MutParam");

/** 当前 Schedule 内唯一的系统编号。 */
export type SystemId = number & { readonly [SystemIdBrand]: "SystemId" };

/** 系统参数中 State 的可写类型视图。 */
export type Mut<T> = { -readonly [K in keyof T]: T[K] } & {
    readonly [MutBrand]: "Mut";
};

/** 无访问修饰符的系统参数类型。 */
export type BareSystemParam =
    | typeof World
    | ResourceType
    | StateType
    | ServiceType
    | QueryType<QueryComponentTuple>;

/** 允许声明为可写的系统参数，目前仅支持 State。 */
export type MutableSystemParam = StateType;

/** `Write()` 生成的可写参数描述。 */
export interface MutParam<T extends MutableSystemParam = MutableSystemParam> {
    readonly [MUT_PARAM]: true;
    readonly target: T;
}

/**
 * 声明系统对指定 State 的写访问。
 * @param target State 构造类型。
 */
export function Write<const T extends MutableSystemParam>(target: T): MutParam<T> {
    if (!(target.prototype instanceof State)) {
        throw new TypeError(`Mut only accepts a State type: ${target.name}`);
    }
    return Object.freeze({ [MUT_PARAM]: true as const, target });
}

/** Builder 可接受的全部系统参数描述。 */
export type SystemParam = BareSystemParam | MutParam;

type InstanceOfParam<T> =
    T extends typeof World ? World :
    T extends QueryType<infer Components> ? Query<Components> :
    T extends ResourceType<infer Value> ? Value :
    T extends StateType<infer Value> ? Value :
    T extends ServiceType<infer Value> ? Value :
    never;

/** 将参数描述转换为系统函数实际收到的值类型。 */
export type SystemParamValue<T> =
    T extends MutParam<infer Target> ? Mut<InstanceOfParam<Target>> :
    T extends ResourceType<infer Value> ? Readonly<Value> :
    T extends StateType<infer Value> ? Readonly<Value> :
    InstanceOfParam<T>;

/** 根据参数元组生成系统函数参数元组。 */
export type SystemArgs<Params extends readonly SystemParam[]> = {
    [K in keyof Params]: SystemParamValue<Params[K]>;
};

/** 由 Scheduler 调用的纯系统函数类型。 */
export type SystemFunction<Params extends readonly SystemParam[] = readonly SystemParam[]> =
    (...args: SystemArgs<Params>) => void;

/** 系统声明的 Resource、State 和 World 访问集合。 */
export interface SystemAccess {
    readonly reads: ReadonlySet<ResourceType | StateType>;
    readonly writes: ReadonlySet<StateType>;
    readonly world: boolean;
}

/** 注册系统后返回的稳定句柄。 */
export interface SystemHandle {
    readonly id: SystemId;
    readonly name: string;
    readonly stage: UpdateStage;
}

/** Scheduler 编译前保存的完整系统定义。 */
export interface SystemDefinition {
    readonly handle: SystemHandle;
    readonly fn: (...args: any[]) => void;
    readonly params: readonly SystemParam[];
    readonly registrationIndex: number;
    readonly access: SystemAccess;
}

/** 判断参数描述是否由 `Write()` 创建。 */
export function isMutParam(value: SystemParam): value is MutParam {
    return typeof value === "object" && value !== null && MUT_PARAM in value;
}
