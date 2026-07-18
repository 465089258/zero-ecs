import { CommandService, RandomService, TimeState, Update, Write, type Module, type EcsBuilder, type SystemHandle } from "zero-ecs-lib";
import { GameConfig } from "../common/game-config";
import { ZombieConfig } from "./config";
import { WaveConfig } from "./wave-config";
import { WaveState } from "./wave-state";
import { GameState } from "../common/game-state";
import { ZombieQuery } from "./query";
import { spawnSystem } from "./spawn-system";
import { moveZombiesSystem } from "./move";

export class ZombieModule implements Module {
    spawnId: SystemHandle = 0 as any;
    moveId: SystemHandle = 0 as any;

    build(builder: EcsBuilder): void {
        builder.addResource(ZombieConfig, new ZombieConfig());
        builder.addResource(WaveConfig, new WaveConfig());
        builder.addState(WaveState);

        this.spawnId = builder.addSystem(Update.fixed, spawnSystem, [
            GameConfig, ZombieConfig, WaveConfig, TimeState, Write(GameState), Write(WaveState), RandomService, CommandService,
        ]);
        this.moveId = builder.addSystem(Update.fixed, moveZombiesSystem, [
            GameConfig, TimeState, GameState, ZombieQuery,
        ]);
    }
}
