import type { GameBuilder, Module } from "@zero-ecs/game";
import { GameState } from "./game-state";
import { GameConfigResource, GameViewResource } from "./resources";
import { InputService } from "./services/input-service";
import { MetricsService } from "./services/metrics-service";

/** 向所有功能模块提供共享资源、状态和基础服务。 */
export class CommonModule implements Module {
    constructor(
        readonly view: GameViewResource,
        readonly config = new GameConfigResource(),
    ) {}

    build(builder: GameBuilder): void {
        builder
            .addResource(GameViewResource, this.view)
            .addResource(GameConfigResource, this.config)
            .addState(GameState)
            .addService(InputService)
            .addService(MetricsService);
    }
}
