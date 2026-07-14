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

export type SystemId = number & { readonly [SystemIdBrand]: "SystemId" };

export type Mut<T> = { -readonly [K in keyof T]: T[K] } & {
    readonly [MutBrand]: "Mut";
};

export type BareSystemParam =
    | typeof World
    | ResourceType
    | StateType
    | ServiceType
    | QueryType<QueryComponentTuple>;

export type MutableSystemParam = StateType;

export interface MutParam<T extends MutableSystemParam = MutableSystemParam> {
    readonly [MUT_PARAM]: true;
    readonly target: T;
}

export function Write<const T extends MutableSystemParam>(target: T): MutParam<T> {
    if (!(target.prototype instanceof State)) {
        throw new TypeError(`Mut only accepts a State type: ${target.name}`);
    }
    return Object.freeze({ [MUT_PARAM]: true as const, target });
}

export type SystemParam = BareSystemParam | MutParam;

type InstanceOfParam<T> =
    T extends typeof World ? World :
    T extends QueryType<infer Components> ? Query<Components> :
    T extends ResourceType<infer Value> ? Value :
    T extends StateType<infer Value> ? Value :
    T extends ServiceType<infer Value> ? Value :
    never;

export type SystemParamValue<T> =
    T extends MutParam<infer Target> ? Mut<InstanceOfParam<Target>> : InstanceOfParam<T>;

export type SystemArgs<Params extends readonly SystemParam[]> = {
    [K in keyof Params]: SystemParamValue<Params[K]>;
};

export type SystemFunction<Params extends readonly SystemParam[] = readonly SystemParam[]> =
    (...args: SystemArgs<Params>) => void;

export interface SystemAccess {
    readonly reads: ReadonlySet<ResourceType | StateType>;
    readonly writes: ReadonlySet<StateType>;
    readonly world: boolean;
}

export interface SystemHandle {
    readonly id: SystemId;
    readonly name: string;
    readonly stage: UpdateStage;
}

export interface SystemDefinition {
    readonly handle: SystemHandle;
    readonly fn: (...args: any[]) => void;
    readonly params: readonly SystemParam[];
    readonly registrationIndex: number;
    readonly access: SystemAccess;
}

export function isMutParam(value: SystemParam): value is MutParam {
    return typeof value === "object" && value !== null && MUT_PARAM in value;
}
