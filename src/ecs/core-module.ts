import type { Module } from "../runtime/module";
import type { EcsBuilder } from "../runtime/ecs-builder";
import { ArchetypeService, ArchetypeState } from "./archetype/archetype-service";
import { ComponentRegistryState, ComponentService } from "./component/component-registry";
import { EntityService, EntityState } from "./entity/entity-service";
import { EcsMemoryService } from "./memory/ecs-memory-service";
import { QueryService } from "./query/query-service";

/** 安装内存、组件、原型、实体与查询等 ECS 核心基础设施。 */
export class CoreEcsModule implements Module {
    /** 向 EcsBuilder 注册核心 State 与 Service。 */
    build(builder: EcsBuilder): void {
        builder.addState(ComponentRegistryState);
        builder.addState(ArchetypeState);
        builder.addState(EntityState);
        builder.addService(EcsMemoryService);
        builder.addService(ComponentService);
        builder.addService(ArchetypeService);
        builder.addService(EntityService);
        builder.addService(QueryService);
    }
}
