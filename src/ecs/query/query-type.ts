import type { QueryComponentsOf, QueryComponentTuple, QueryTypeNode } from "./filter";

/** Static, world-independent query definition. */
export class QueryType<Components extends QueryComponentTuple> {
    declare readonly __components: Components;
    constructor(readonly ast: QueryTypeNode) { Object.freeze(this); }
    static from<Ast extends QueryTypeNode>(ast: Ast): QueryType<QueryComponentsOf<Ast>> {
        return new QueryType(ast) as QueryType<QueryComponentsOf<Ast>>;
    }
}
