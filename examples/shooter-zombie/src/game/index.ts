import { CommandService, RandomService, Startup, Update, Write, type Module, type EcsBuilder, type SystemHandle } from "zero-ecs-lib";
import { GameConfig } from "../common/game-config";
import { GameViewResource } from "../common/game-view-resource";
import { GameState } from "../common/game-state";
import { RenderState } from "../renderer/render-state";
import { RendererService } from "../renderer/renderer-service";
import { ShooterConfig } from "../shooter/config";
import { ShooterState } from "../shooter/state";
import { WallConfig } from "../wall/config";
import { WaveState } from "../zombie/wave-state";
import { InputService } from "../common/input-service";
import { BulletQuery } from "../bullet/query";
import { ZombieQuery } from "../zombie/query";
import { ExpOrbQuery } from "../exp-orb/query";
import { ShooterQuery } from "../shooter/query";
import { GameEntityQuery } from "./query";
import { startupGameSystem } from "./startup";
import { restartSystem } from "./restart";
import { levelUpSystem } from "./level-up";
import { statisticsSystem } from "./stats";

export class GameModule implements Module {
    restartId: SystemHandle = 0 as any;
    levelUpId: SystemHandle = 0 as any;
    statsId: SystemHandle = 0 as any;

    build(builder: EcsBuilder): void {
        builder.addSystem(Startup, startupGameSystem, [
            CommandService, GameViewResource, GameConfig, Write(GameState), RenderState, RendererService,
            ShooterConfig, ShooterState, WallConfig,
        ]);
        this.restartId = builder.addSystem(Update.fixed, restartSystem, [
            InputService, CommandService, Write(GameState), Write(WaveState), Write(ShooterState),
            GameConfig, ShooterConfig, WallConfig, GameEntityQuery,
        ]);
        this.levelUpId = builder.addSystem(Update.fixed, levelUpSystem, [
            Write(GameState), Write(ShooterState), RandomService, InputService, CommandService,
            GameConfig, ShooterConfig, ShooterQuery,
        ]);
        this.statsId = builder.addSystem(Update.fixed, statisticsSystem, [
            Write(GameState), WallConfig, BulletQuery, ZombieQuery, ExpOrbQuery, GameEntityQuery,
        ]);
    }
}
