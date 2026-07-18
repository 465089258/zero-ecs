import { CommandService, Update, Write, type Module, type EcsBuilder, type SystemHandle } from "zero-ecs-lib";
import { GameConfig } from "../common/game-config";
import { WallConfig } from "./config";
import { GameState } from "../common/game-state";
import { WallQuery } from "./query";
import { ZombieQuery } from "../zombie/query";
import { zombieWallCollisionSystem } from "./collision";

export class WallModule implements Module {
    collisionId: SystemHandle = 0 as any;
    build(builder: EcsBuilder): void {
        builder.addResource(WallConfig, new WallConfig());
        this.collisionId = builder.addSystem(Update.fixed, zombieWallCollisionSystem, [
            GameConfig, Write(GameState), CommandService, ZombieQuery, WallQuery,
        ]);
    }
}
