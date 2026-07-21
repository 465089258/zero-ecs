import type { QueryDataType, QueryDataValue } from "./query-data";

/** QueryType AST 节点类型。 */
export const QueryNodeKind = Object.freeze({
    With: 0,
    Without: 1,
    Optional: 2,
    All: 3,
    Any: 4,
} as const);
export type QueryNodeKind = (typeof QueryNodeKind)[keyof typeof QueryNodeKind];

/** 要求原型包含指定组件，并将其列加入查询结果。 */
export interface WithNode<T extends readonly QueryDataType[] = readonly QueryDataType[]> {
    readonly kind: typeof QueryNodeKind.With;
    readonly components: T;
}
/** 要求原型不包含指定组件，不产生查询结果列。 */
export interface WithoutNode<T extends readonly QueryDataType[] = readonly QueryDataType[]> {
    readonly kind: typeof QueryNodeKind.Without;
    readonly components: T;
}
/** 不参与原型匹配；组件存在时返回列，否则返回 `undefined`。 */
export interface OptionalNode<T extends readonly QueryDataType[] = readonly QueryDataType[]> {
    readonly kind: typeof QueryNodeKind.Optional;
    readonly components: T;
}
/** 要求所有子条件同时成立。 */
export interface AllNode<T extends readonly QueryTypeNode[] = readonly QueryTypeNode[]> {
    readonly kind: typeof QueryNodeKind.All;
    readonly children: T;
}
/** 要求至少一个子条件成立。 */
export interface AnyNode<T extends readonly QueryTypeNode[] = readonly QueryTypeNode[]> {
    readonly kind: typeof QueryNodeKind.Any;
    readonly children: T;
}
/** QueryType 支持的 AST 节点联合。 */
export type QueryTypeNode = WithNode | WithoutNode | OptionalNode | AllNode | AnyNode;

function requireItems(name: string, items: readonly unknown[]): void {
    if (items.length === 0) throw new Error(`${name} requires at least one item`);
}

/** 创建“包含组件”条件，并按传入顺序选择组件列。 */
export function With<T extends readonly QueryDataType[]>(...components: T): WithNode<T> {
    requireItems("With", components);
    return Object.freeze({ kind: QueryNodeKind.With, components: Object.freeze([...components]) }) as WithNode<T>;
}
/** 创建“不包含组件”条件；该条件不选择组件列。 */
export function Without<T extends readonly QueryDataType[]>(...components: T): WithoutNode<T> {
    requireItems("Without", components);
    return Object.freeze({ kind: QueryNodeKind.Without, components: Object.freeze([...components]) }) as WithoutNode<T>;
}
/** 创建可选组件选择；原型不包含组件时，对应结果为 `undefined`。 */
export function Optional<T extends readonly QueryDataType[]>(...components: T): OptionalNode<T> {
    requireItems("Optional", components);
    return Object.freeze({ kind: QueryNodeKind.Optional, components: Object.freeze([...components]) }) as OptionalNode<T>;
}
/** 创建逻辑与条件。 */
export function All<T extends readonly QueryTypeNode[]>(...children: T): AllNode<T> {
    requireItems("All", children);
    return Object.freeze({ kind: QueryNodeKind.All, children: Object.freeze([...children]) }) as AllNode<T>;
}
/** 创建逻辑或条件；不同分支未选择的组件列会返回 `undefined`。 */
export function Any<T extends readonly QueryTypeNode[]>(...children: T): AnyNode<T> {
    requireItems("Any", children);
    return Object.freeze({ kind: QueryNodeKind.Any, children: Object.freeze([...children]) }) as AnyNode<T>;
}

/** 查询所选组件实例的类型元组。 */
export type QueryComponentTuple = readonly (object | undefined)[];
type Instances<T extends readonly QueryDataType[]> = { [K in keyof T]: QueryDataValue<T[K]> };
type OptionalInstances<T extends readonly QueryDataType[]> = { [K in keyof T]: QueryDataValue<T[K]> | undefined };
type Optionalize<T extends QueryComponentTuple> = { [K in keyof T]: T[K] | undefined };

/** 按子节点顺序合并查询结果类型。 */
export type QueryComponentsOfChildren<
    Children extends readonly QueryTypeNode[],
    Result extends QueryComponentTuple = [],
> = Children extends readonly [infer First extends QueryTypeNode, ...infer Rest extends QueryTypeNode[]]
    ? QueryComponentsOfChildren<Rest, [...Result, ...QueryComponentsOf<First>]>
    : Result;

/** 从 QueryType AST 推导查询结果中的组件类型元组。 */
export type QueryComponentsOf<Node extends QueryTypeNode> =
    Node extends WithNode<infer T> ? Instances<T> :
    Node extends OptionalNode<infer T> ? OptionalInstances<T> :
    Node extends WithoutNode ? [] :
    Node extends AllNode<infer T> ? QueryComponentsOfChildren<T> :
    Node extends AnyNode<infer T> ? Optionalize<QueryComponentsOfChildren<T>> :
    [];
