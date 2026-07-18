import { type EcsBuilder, type Module } from "zero-ecs-lib";
import { restartSystem } from "../lifecycle/systems";
import { moveBulletsSystem } from "../projectile/systems";
import { moveZombiesSystem, spawnSystem, zombieWallCollisionSystem } from "./systems";

export class ZombieModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addSystem(spawnSystem, { after: restartSystem });

        builder.addSystem(moveZombiesSystem, { after: moveBulletsSystem });

        builder.addSystem(zombieWallCollisionSystem, { after: moveZombiesSystem });
    }
}
