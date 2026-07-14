import { EntityMigrationService } from "./entity-migration-service";

/** @internal 在内部 Post 阶段提交全部实体迁移。 */
export function flushEntityMigrationSystem(migration: EntityMigrationService): void {
    migration.flush();
}
