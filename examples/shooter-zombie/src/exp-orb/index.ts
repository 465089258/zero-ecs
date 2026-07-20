import { CommandService, Update, Write, type Module, type EcsBuilder, type SystemHandle } from "zero-ecs-lib";
import { ExpOrbConfig } from "./config";
import { GameState } from "../common/game-state";
import { ExpOrbQuery } from "./query";
import { ShooterQuery } from "../shooter/query";
import { expCollectSystem } from "./collect";

export class ExpOrbModule implements Module {
    collectId: SystemHandle = 0 as any;
    build(builder: EcsBuilder): void {
        builder.addResource(ExpOrbConfig, new ExpOrbConfig());
        this.collectId = builder.addSystem(Update.fixed, expCollectSystem, [
            Write(GameState), CommandService, ExpOrbQuery, ShooterQuery,
        ]);
    }
}
