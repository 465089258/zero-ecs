import { CommandService, RandomService, TimeState, Update, type Module, type EcsBuilder, type SystemHandle } from "zero-ecs-lib";
import { GameConfig } from "../common/game-config";
import { ShooterConfig } from "./config";
import { ShooterState } from "./state";
import { GameState } from "../common/game-state";
import { BulletConfig } from "../bullet/config";
import { ShooterQuery } from "./query";
import { ZombieQuery } from "../zombie/query";
import { shooterFireSystem } from "./fire";

export class ShooterModule implements Module {
    fireId: SystemHandle = 0 as any;

    build(builder: EcsBuilder): void {
        builder.addResource(ShooterConfig, new ShooterConfig());
        builder.addState(ShooterState);

        this.fireId = builder.addSystem(Update.fixed, shooterFireSystem, [
            GameConfig, ShooterConfig, BulletConfig, TimeState, RandomService, GameState, CommandService, ShooterQuery, ZombieQuery,
        ]);
    }
}
