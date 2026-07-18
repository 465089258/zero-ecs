import { CommandService, RandomService, TimeState, Update, Write, type Module, type EcsBuilder, type SystemHandle } from "zero-ecs-lib";
import { GameConfig } from "../common/game-config";
import { BulletConfig } from "./config";
import { GameState } from "../common/game-state";
import { BulletQuery } from "./query";
import { ZombieQuery } from "../zombie/query";
import { ExpOrbConfig } from "../exp-orb/config";
import { moveBulletsSystem } from "./move";
import { bulletZombieCollisionSystem } from "./collision";

export class BulletModule implements Module {
    moveId: SystemHandle = 0 as any;
    collisionId: SystemHandle = 0 as any;

    build(builder: EcsBuilder): void {
        builder.addResource(BulletConfig, new BulletConfig());

        this.moveId = builder.addSystem(Update.fixed, moveBulletsSystem, [
            GameConfig, TimeState, GameState, CommandService, BulletQuery,
        ]);
        this.collisionId = builder.addSystem(Update.fixed, bulletZombieCollisionSystem, [
            GameConfig, BulletConfig, ExpOrbConfig, Write(GameState), RandomService, CommandService, BulletQuery, ZombieQuery,
        ]);
    }
}
