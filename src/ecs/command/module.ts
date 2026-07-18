import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import {
    EntityMigrationPoolService,
    EntityMigrationService,
    EntityMigrationState,
} from "../migration/entity-migration-service";
import { flushEntityMigrationSystem } from "../migration/systems";
import { CommandPoolService, CommandService, CommandState } from "./command-service";
import { flushCommandSystem } from "./systems";

/** 注册命令队列、实体迁移及其内部 Post 系统。 */
export class CommandModule implements Module {
    /** 向 EcsBuilder 安装命令模块。 */
    build(builder: EcsBuilder): void {
        builder.addState(CommandState);
        builder.addService(CommandPoolService);
        builder.addService(CommandService);
        builder.addState(EntityMigrationState);
        builder.addService(EntityMigrationPoolService);
        builder.addService(EntityMigrationService);
        builder.addSystem(flushCommandSystem);
        builder.addSystem(flushEntityMigrationSystem);
    }
}
