import type { QueryComponentsOf, QueryComponentTuple, QueryTypeNode } from "./filter";

/** 与 World 无关、可复用的静态查询定义。 */
export class QueryType<Components extends QueryComponentTuple> {
    declare readonly __components: Components;
    /** 使用不可变 Filter AST 创建查询定义。 */
    constructor(readonly ast: QueryTypeNode) { Object.freeze(this); }

    /** 创建 QueryType，并从 AST 自动推导查询结果类型。 */
    static from<Ast extends QueryTypeNode>(ast: Ast): QueryType<QueryComponentsOf<Ast>> {
        return new QueryType(ast) as QueryType<QueryComponentsOf<Ast>>;
    }
}
