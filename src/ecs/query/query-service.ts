import { Service } from "../../context/types";
import { ArchetypeService } from "../archetype/archetype-service";
import { ComponentService } from "../component/component-registry";
import { Query } from "./query";
import type { QueryType } from "./query-type";

export class QueryService extends Service {
    @Service.inject(ComponentService) private readonly _components!: ComponentService;
    @Service.inject(ArchetypeService) private readonly _archetypes!: ArchetypeService;

    create<Components extends readonly (object | undefined)[]>(type: QueryType<Components>): Query<Components> {
        return new Query(type, this._components, this._archetypes);
    }
}
