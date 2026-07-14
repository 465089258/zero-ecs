import {
    CommandService,
    RandomService,
    Startup,
    TimeState,
    Update,
    Write,
    type EcsBuilder,
    type Module,
} from "zero-ecs-lib";
import { BallQuery, BrickQuery, GameEntityQuery, PaddleQuery, PowerUpQuery } from "./queries";
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

        builder.addSystem(Startup, startupGameSystem, [
            SpawnService,
            RendererService,
            Write(GameState),
            BallQuery,
            PaddleQuery,
            BrickQuery,
            PowerUpQuery,
        ]);

        const restart = builder.addSystem(Update.fixed, restartSystem, [
            InputService,
            CommandService,
            SpawnService,
            Write(GameState),
            GameEntityQuery,
        ]);
        const paddle = builder.addSystem(Update.fixed, paddleMovementSystem, [
            GameConfigResource,
            TimeState,
            InputService,
            GameState,
            PaddleQuery,
        ]);
        const moveBalls = builder.addSystem(Update.fixed, moveBallsSystem, [
            GameConfigResource,
            TimeState,
            GameState,
            CommandService,
            BallQuery,
        ]);
        const movePowers = builder.addSystem(Update.fixed, movePowersSystem, [
            GameConfigResource,
            TimeState,
            GameState,
            CommandService,
            PowerUpQuery,
        ]);
        const collide = builder.addSystem(Update.fixed, collisionSystem, [
            GameConfigResource,
            Write(GameState),
            RandomService,
            CommandService,
            SpawnService,
            BallQuery,
            PaddleQuery,
            BrickQuery,
        ]);
        const collect = builder.addSystem(Update.fixed, collectPowerSystem, [
            GameConfigResource,
            Write(GameState),
            CommandService,
            SpawnService,
            BallQuery,
            PaddleQuery,
            PowerUpQuery,
        ]);
        const stress = builder.addSystem(Update.fixed, stressActionsSystem, [
            GameConfigResource,
            InputService,
            Write(GameState),
            SpawnService,
            BallQuery,
        ]);
        const lifecycle = builder.addSystem(Update.fixed, lifecycleSystem, [
            GameConfigResource,
            Write(GameState),
            SpawnService,
            BallQuery,
        ]);
        const statistics = builder.addSystem(Update.fixed, statisticsSystem, [
            Write(GameState),
            BallQuery,
            BrickQuery,
            PowerUpQuery,
            GameEntityQuery,
        ]);

        builder.chain(restart, paddle, moveBalls, movePowers, collide, collect, stress, lifecycle, statistics);
    }
}
