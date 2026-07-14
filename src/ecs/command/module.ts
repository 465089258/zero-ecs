import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { InternalPost } from "../../schedule/internal-stage";
import { EntityMigrationService } from "../migration/entity-migration-service";
import { flushEntityMigrationSystem } from "../migration/systems";
import { CommandService } from "./command-service";
import { flushCommandSystem } from "./systems";

/** 注册命令队列、实体迁移及其内部 Post 系统。 */
export class CommandModule implements Module {
    /** 向 EcsBuilder 安装命令模块。 */
    build(builder: EcsBuilder): void {
        builder.addService(CommandService);
        builder.addService(EntityMigrationService);
        builder.addSystem(InternalPost.command, flushCommandSystem, [CommandService]);
        builder.addSystem(InternalPost.migration, flushEntityMigrationSystem, [EntityMigrationService]);
    }
}
