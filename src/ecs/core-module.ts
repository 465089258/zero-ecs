import type { Module } from "../runtime/module";
import type { EcsBuilder } from "../runtime/ecs-builder";
import { ArchetypeService } from "./archetype/archetype-service";
import { ComponentRegistryState, ComponentService } from "./component/component-registry";
import { EntityService } from "./entity/entity-service";
import { EcsMemoryService } from "./memory/ecs-memory-service";
import { QueryService } from "./query/query-service";

/** Required memory, component, archetype, entity and query infrastructure. */
export class CoreEcsModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addState(ComponentRegistryState);
        builder.addService(EcsMemoryService);
        builder.addService(ComponentService);
        builder.addService(ArchetypeService);
        builder.addService(EntityService);
        builder.addService(QueryService);
    }
}
