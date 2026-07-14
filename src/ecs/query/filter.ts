import type { ComponentType } from "../component/component";

export const enum QueryNodeKind { With, Without, Optional, All, Any }

export interface WithNode<T extends readonly ComponentType[] = readonly ComponentType[]> {
    readonly kind: QueryNodeKind.With;
    readonly components: T;
}
export interface WithoutNode<T extends readonly ComponentType[] = readonly ComponentType[]> {
    readonly kind: QueryNodeKind.Without;
    readonly components: T;
}
export interface OptionalNode<T extends readonly ComponentType[] = readonly ComponentType[]> {
    readonly kind: QueryNodeKind.Optional;
    readonly components: T;
}
export interface AllNode<T extends readonly QueryTypeNode[] = readonly QueryTypeNode[]> {
    readonly kind: QueryNodeKind.All;
    readonly children: T;
}
export interface AnyNode<T extends readonly QueryTypeNode[] = readonly QueryTypeNode[]> {
    readonly kind: QueryNodeKind.Any;
    readonly children: T;
}
export type QueryTypeNode = WithNode | WithoutNode | OptionalNode | AllNode | AnyNode;

function requireItems(name: string, items: readonly unknown[]): void {
    if (items.length === 0) throw new Error(`${name} requires at least one item`);
}

export function With<T extends readonly ComponentType[]>(...components: T): WithNode<T> {
    requireItems("With", components);
    return Object.freeze({ kind: QueryNodeKind.With, components: Object.freeze([...components]) }) as WithNode<T>;
}
export function Without<T extends readonly ComponentType[]>(...components: T): WithoutNode<T> {
    requireItems("Without", components);
    return Object.freeze({ kind: QueryNodeKind.Without, components: Object.freeze([...components]) }) as WithoutNode<T>;
}
export function Optional<T extends readonly ComponentType[]>(...components: T): OptionalNode<T> {
    requireItems("Optional", components);
    return Object.freeze({ kind: QueryNodeKind.Optional, components: Object.freeze([...components]) }) as OptionalNode<T>;
}
export function All<T extends readonly QueryTypeNode[]>(...children: T): AllNode<T> {
    requireItems("All", children);
    return Object.freeze({ kind: QueryNodeKind.All, children: Object.freeze([...children]) }) as AllNode<T>;
}
export function Any<T extends readonly QueryTypeNode[]>(...children: T): AnyNode<T> {
    requireItems("Any", children);
    return Object.freeze({ kind: QueryNodeKind.Any, children: Object.freeze([...children]) }) as AnyNode<T>;
}

export type QueryComponentTuple = readonly (object | undefined)[];
type Instances<T extends readonly ComponentType[]> = { [K in keyof T]: InstanceType<T[K]> };
type OptionalInstances<T extends readonly ComponentType[]> = { [K in keyof T]: InstanceType<T[K]> | undefined };
type Optionalize<T extends QueryComponentTuple> = { [K in keyof T]: T[K] | undefined };

export type QueryComponentsOfChildren<
    Children extends readonly QueryTypeNode[],
    Result extends QueryComponentTuple = [],
> = Children extends readonly [infer First extends QueryTypeNode, ...infer Rest extends QueryTypeNode[]]
    ? QueryComponentsOfChildren<Rest, [...Result, ...QueryComponentsOf<First>]>
    : Result;

export type QueryComponentsOf<Node extends QueryTypeNode> =
    Node extends WithNode<infer T> ? Instances<T> :
    Node extends OptionalNode<infer T> ? OptionalInstances<T> :
    Node extends WithoutNode ? [] :
    Node extends AllNode<infer T> ? QueryComponentsOfChildren<T> :
    Node extends AnyNode<infer T> ? Optionalize<QueryComponentsOfChildren<T>> :
    [];
