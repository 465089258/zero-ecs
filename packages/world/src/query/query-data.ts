import type { ComponentType } from "../component/component";

declare const QueryProjectionBrand: unique symbol;
declare const ProjectedQueryDataBrand: unique symbol;

/**
 * 只能参与 Query、不能传给 EntityCommand 的只读数据投影 Token。
 *
 * 具体存储组件由组合层在 World 构建冷路径注册；Token 自身不暴露 constructor。
 */
export interface QueryProjection<T extends object = object> {
    readonly name: string;
    readonly [QueryProjectionBrand]: T;
}

/** Query 语法可以选择的普通组件或只读投影。 */
export type QueryDataType<T extends object = object> = ComponentType<T> | QueryProjection<T>;

/** QueryType 保存的投影选择标记；运行时不会创建对应对象。 */
export interface ProjectedQueryData<T extends object> {
    readonly [ProjectedQueryDataBrand]: T;
}

/** 从 Query 数据 Token 推导 QueryType 内部保存的选择类型。 */
export type QueryDataValue<T extends QueryDataType> =
    T extends ComponentType<infer Value> ? Value :
    T extends QueryProjection<infer Value> ? ProjectedQueryData<Value> :
    never;

/** 创建一个不携带存储实现的只读 Query 投影 Token。 */
export function defineQueryProjection<T extends object>(name: string): QueryProjection<T> {
    if (typeof name !== "string" || name.length === 0) {
        throw new TypeError("Query projection name must be a non-empty string");
    }
    return Object.freeze({ name }) as QueryProjection<T>;
}

/** @internal 返回普通组件或投影的诊断名称。 */
export function queryDataName(type: QueryDataType): string {
    return typeof type === "function" ? type.name : type.name;
}
