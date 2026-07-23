import type { ComponentType } from "../component/component";

declare const QueryProjectionBrand: unique symbol;
declare const ProjectedQueryDataBrand: unique symbol;
const projectionStorage = new WeakMap<QueryProjection, ComponentType>();

/**
 * 只能参与 Query、不能作为可变 ComponentType 使用的只读数据投影 Token。
 *
 * Token 在定义时绑定实际存储组件，但不向使用者暴露该 ComponentType。
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

/** 创建一个绑定隐藏存储组件的只读 Query 投影 Token。 */
export function defineQueryProjection<T extends object>(
    storage: ComponentType<T>,
    name?: string,
): QueryProjection<T> {
    if (typeof storage !== "function") {
        throw new TypeError("Query projection storage must be a ComponentType");
    }
    const projectionName = name ?? storage.name;
    if (typeof projectionName !== "string" || projectionName.length === 0) {
        throw new TypeError("Query projection name must be a non-empty string");
    }
    const projection = Object.freeze({ name: projectionName }) as QueryProjection<T>;
    projectionStorage.set(projection, storage);
    return projection;
}

/** @internal 解析只读 Query 投影绑定的实际存储组件。 */
export function storageOfQueryProjection<T extends object>(
    projection: QueryProjection<T>,
): ComponentType<T> {
    const storage = projectionStorage.get(projection);
    if (!storage) throw new TypeError(`Invalid Query projection: ${projection.name}`);
    return storage as ComponentType<T>;
}

/** @internal 返回普通组件或投影的诊断名称。 */
export function queryDataName(type: QueryDataType): string {
    return typeof type === "function" ? type.name : type.name;
}
