import type { Module, EcsBuilder } from "zero-ecs-lib";
import { GameConfig } from "./game-config";
import { GameViewResource } from "./game-view-resource";
import { GameState } from "./game-state";
import { InputService } from "./input-service";
import { MetricsService } from "./metrics-service";

export class CommonModule implements Module {
    constructor(readonly view: GameViewResource) {}
    build(builder: EcsBuilder): void {
        builder
            .addResource(GameConfig, new GameConfig())
            .addResource(GameViewResource, this.view)
            .addState(GameState)
            .addService(InputService)
            .addService(MetricsService);
    }
}
