import { defSystem } from "../runtime/system";
import { Update } from "../runtime/stage";
import { Migrations } from "./migration-service";

/** 在 Structure SystemSet 中应用每个 Entity 的最终迁移事务。 */
export const applyMigrationsSystem = defSystem(Update.post, applyMigrations, [Migrations]);

function applyMigrations(migrations: Migrations): void {
    migrations.apply();
}
