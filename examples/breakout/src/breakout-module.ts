import {
    type EcsBuilder,
    type Module,
} from "zero-ecs-lib";
import { GameConfigResource, GameViewResource } from "./resources";
import { InputService } from "./services/input-service";
import { MetricsService } from "./services/metrics-service";
import { RendererService } from "./services/renderer-service";
import { SpawnService } from "./services/spawn-service";
import { GameState } from "./states";
import {
    collectPowerSystem,
    collisionSystem,
    lifecycleSystem,
    moveBallsSystem,
    movePowersSystem,
    paddleMovementSystem,
    restartSystem,
    startupGameSystem,
    statisticsSystem,
    stressActionsSystem,
} from "./systems";

export class BreakoutModule implements Module {
    constructor(
        readonly view: GameViewResource,
        readonly config = new GameConfigResource(),
    ) {}

    build(builder: EcsBuilder): void {
        builder
            .addResource(GameViewResource, this.view)
            .addResource(GameConfigResource, this.config)
            .addState(GameState)
            .addService(InputService)
            .addService(MetricsService)
            .addService(SpawnService)
            .addService(RendererService);

        builder.addSystem(startupGameSystem);
        const restart = builder.addSystem(restartSystem);
        const paddle = builder.addSystem(paddleMovementSystem);
        const moveBalls = builder.addSystem(moveBallsSystem);
        const movePowers = builder.addSystem(movePowersSystem);
        const collide = builder.addSystem(collisionSystem);
        const collect = builder.addSystem(collectPowerSystem);
        const stress = builder.addSystem(stressActionsSystem);
        const lifecycle = builder.addSystem(lifecycleSystem);
        const statistics = builder.addSystem(statisticsSystem);

        builder.chain(restart, paddle, moveBalls, movePowers, collide, collect, stress, lifecycle, statistics);
    }
}
