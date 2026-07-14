import type { Module } from "../../runtime/module";
import type { EcsBuilder } from "../../runtime/ecs-builder";
import { InternalPost } from "../../schedule/internal-stage";
import { EntityMigrationService } from "../migration/entity-migration-service";
import { flushEntityMigrationSystem } from "../migration/systems";
import { CommandService } from "./command-service";
import { flushCommandSystem } from "./systems";

export class CommandModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addService(CommandService);
        builder.addService(EntityMigrationService);
        builder.addSystem(InternalPost.command, flushCommandSystem, [CommandService]);
        builder.addSystem(InternalPost.migration, flushEntityMigrationSystem, [EntityMigrationService]);
    }
}
