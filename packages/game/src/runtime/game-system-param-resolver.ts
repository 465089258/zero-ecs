import type { InjectionContext } from "../context/injection/injection";
import { Resource, type ResourceType } from "../context/resource";
import { Service, type ServiceType } from "../context/service";
import { State, type StateType } from "../context/state";
import { QueryType, World } from "@zero-ecs/world";
import type { SystemParamProvider } from "@zero-ecs/scheduler";
import {
    isMutParam,
    type SystemParam,
    type SystemParamValue,
} from "./system";

/** Game 默认的固定系统参数解析器。 */
export class GameSystemParamResolver implements SystemParamProvider<SystemParam> {
    constructor(private readonly _context: InjectionContext) {}

    resolve<P extends SystemParam>(param: P): SystemParamValue<P> {
        const world = this._context.world;
        let value: unknown;
        if (isMutParam(param)) value = this._context.states.get(param.target);
        else if (param === World) value = world;
        else if (param instanceof QueryType) value = world.query(param);
        else if (param.prototype instanceof Resource) value = this._context.resources.get(param as ResourceType);
        else if (param.prototype instanceof State) value = this._context.states.get(param as StateType);
        else if (param.prototype instanceof Service) value = this._context.services.get(param as ServiceType);
        else throw new TypeError(`Unsupported system parameter type: ${param.name}`);
        return value as SystemParamValue<P>;
    }
}
