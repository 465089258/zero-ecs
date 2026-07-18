import { type EcsBuilder, type Module } from "zero-ecs-lib";
import { shooterFireSystem } from "../shooter/systems";
import { zombieWallCollisionSystem } from "../zombie/systems";
import { bulletZombieCollisionSystem, moveBulletsSystem } from "./systems";

export class ProjectileModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addSystem(moveBulletsSystem, { after: shooterFireSystem });

        builder.addSystem(bulletZombieCollisionSystem, { after: zombieWallCollisionSystem });
    }
}
