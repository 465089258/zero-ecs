import { type EcsBuilder, type Module } from "zero-ecs-lib";
import { bulletZombieCollisionSystem } from "../projectile/systems";
import { damageTextUpdateSystem, expCollectSystem, levelUpSystem } from "./systems";

export class ProgressionModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addSystem(expCollectSystem, { after: bulletZombieCollisionSystem });

        builder.addSystem(damageTextUpdateSystem, { after: expCollectSystem });

        builder.addSystem(levelUpSystem, { after: damageTextUpdateSystem });
    }
}
