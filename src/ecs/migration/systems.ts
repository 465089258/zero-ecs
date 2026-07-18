import { defSystem, type Mut, Write } from "../../schedule/system";
import { InternalPost } from "../../schedule/internal-stage";
import { EntityService } from "../entity/entity-service";
import { EntityMigrationPoolService, EntityMigrationState } from "./entity-migration-service";

export const flushEntityMigrationSystem = defSystem(
    InternalPost.migration,
    flushEntityMigrations,
    [Write(EntityMigrationState), EntityMigrationPoolService, EntityService],
);

/** @internal 在内部 Post 阶段提交全部实体迁移。 */
function flushEntityMigrations(
    migration: Mut<EntityMigrationState>,
    pool: EntityMigrationPoolService,
    entities: EntityService,
): void {
    for (let i = 0; i < migration.used; i++) {
        const plan = migration.plans[i];
        plan.flush(entities);
        pool.recycle(plan);
    }
    migration.entityToPlan.clear();
    migration.plans.length = 0;
    migration.used = 0;
}
