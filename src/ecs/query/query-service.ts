import { Service } from "../../context/service";
import { ArchetypeService } from "../archetype/archetype-service";
import { ComponentService } from "../component/component-registry";
import { Query } from "./query";
import type { QueryType } from "./query-type";

/** 将静态 QueryType 绑定到当前 World 的查询服务。 */
export class QueryService extends Service {
    @Service.inject(ComponentService) private readonly _components!: ComponentService;
    @Service.inject(ArchetypeService) private readonly _archetypes!: ArchetypeService;

    /** 创建绑定当前 World 的运行时 Query。 */
    create<Components extends readonly (object | undefined)[]>(type: QueryType<Components>): Query<Components> {
        return new Query(type, this._components, this._archetypes);
    }
}
