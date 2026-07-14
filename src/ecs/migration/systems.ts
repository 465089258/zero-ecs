import { EntityMigrationService } from "./entity-migration-service";

export function flushEntityMigrationSystem(migration: EntityMigrationService): void {
    migration.flush();
}
