import {
    Query,
    QueryType,
    type QueryComponentTuple,
    World,
    type WorldView,
} from "@zero-ecs/world";
import type { ResourceType } from "../context/resource";
import type { ServiceToken } from "../context/service";
import { State, type StateType } from "../context/state";
import type { Stage } from "@zero-ecs/scheduler";

declare const MutBrand: unique symbol;
const MUT_PARAM = Symbol("MutParam");
const SYSTEM_METADATA = Symbol("SystemMetadata");

/** 系统参数中 State 的可写类型视图。 */
export type Mut<T> = { -readonly [K in keyof T]: T[K] } & {
    readonly [MutBrand]: "Mut";
};

export type BareSystemParam =
    | typeof World
    | ResourceType
    | StateType
    | ServiceToken
    | QueryType<QueryComponentTuple>;

export type MutableSystemParam = StateType;

export interface MutParam<T extends MutableSystemParam = MutableSystemParam> {
    readonly [MUT_PARAM]: true;
    readonly target: T;
}

/** 声明系统对指定 State 的写访问。 */
export function Write<const T extends MutableSystemParam>(target: T): MutParam<T> {
    if (!(target.prototype instanceof State)) {
        throw new TypeError(`Write only accepts a State type: ${target.name}`);
    }
    return Object.freeze({ [MUT_PARAM]: true as const, target });
}

export type SystemParam = BareSystemParam | MutParam;

type InstanceOfParam<T> =
    T extends typeof World ? WorldView :
    T extends QueryType<infer Components> ? Query<Components> :
    T extends ResourceType<infer Value> ? Value :
    T extends StateType<infer Value> ? Value :
    T extends ServiceToken<infer Value> ? Value :
    never;

export type SystemParamValue<T> =
    T extends MutParam<infer Target> ? Mut<InstanceOfParam<Target>> :
    T extends ResourceType<infer Value> ? Readonly<Value> :
    T extends StateType<infer Value> ? Readonly<Value> :
    InstanceOfParam<T>;

export type SystemArgs<Params extends readonly SystemParam[]> = {
    [K in keyof Params]: SystemParamValue<Params[K]>;
};

export type SystemFunction<Params extends readonly SystemParam[] = readonly SystemParam[]> =
    (...args: SystemArgs<Params>) => void;

export interface SystemMetadata<Params extends readonly SystemParam[] = readonly SystemParam[]> {
    readonly stage: Stage;
    readonly params: Params;
}

export type DefinedSystem<Params extends readonly SystemParam[] = any> =
    SystemFunction<Params> & { readonly [SYSTEM_METADATA]: SystemMetadata<Params> };

/** 把 Game Stage、实现函数和参数描述绑定到原函数，不创建运行时 wrapper。 */
export function defSystem<const Params extends readonly SystemParam[]>(
    stage: Stage,
    fn: SystemFunction<Params>,
    params: Params,
): DefinedSystem<Params> {
    if (Object.prototype.hasOwnProperty.call(fn, SYSTEM_METADATA)) {
        throw new Error(`System ${fn.name || "anonymous"} is already defined`);
    }
    const metadata = Object.freeze({
        stage,
        params: Object.freeze([...params]) as unknown as Params,
    });
    Object.defineProperty(fn, SYSTEM_METADATA, {
        value: metadata,
        enumerable: false,
        configurable: false,
        writable: false,
    });
    return fn as DefinedSystem<Params>;
}

/** @internal 读取 Game 系统定义的不可变元数据。 */
export function systemMetadata<const Params extends readonly SystemParam[]>(
    system: DefinedSystem<Params>,
): SystemMetadata<Params> {
    return system[SYSTEM_METADATA];
}

/** 构建冷路径校验参数声明；当前不为尚无消费者的访问图分配 Set。 */
export function validateSystemParams(params: readonly SystemParam[]): void {
    const declared = new Set<unknown>();
    for (const param of params) {
        if (isMutParam(param)) {
            if (declared.has(param.target)) {
                throw new Error(`System parameter ${param.target.name} is declared more than once`);
            }
            declared.add(param.target);
            continue;
        }
        if (declared.has(param)) {
            const name = typeof param === "function" ? param.name : "QueryType";
            throw new Error(`System parameter ${name} is declared more than once`);
        }
        declared.add(param);
    }
}

export function isMutParam(value: SystemParam): value is MutParam {
    return typeof value === "object" && value !== null && MUT_PARAM in value;
}
