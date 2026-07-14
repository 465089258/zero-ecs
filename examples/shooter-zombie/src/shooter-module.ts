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
import {
    BulletQuery,
    DamageTextQuery,
    ExpOrbQuery,
    GameEntityQuery,
    ShooterQuery,
    WallQuery,
    ZombieQuery,
} from "./queries";
import { GameConfigResource, GameViewResource } from "./resources";
import { InputService } from "./services/input-service";
import { MetricsService } from "./services/metrics-service";
import { RendererService } from "./services/renderer-service";
import { SpawnService } from "./services/spawn-service";
import { GameState } from "./states";
import {
    bulletZombieCollisionSystem,
    damageTextUpdateSystem,
    expCollectSystem,
    levelUpSystem,
    moveBulletsSystem,
    moveZombiesSystem,
    restartSystem,
    shooterFireSystem,
    spawnSystem,
    startupGameSystem,
    statisticsSystem,
    zombieWallCollisionSystem,
} from "./systems";

export class ShooterModule implements Module {
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
            ShooterQuery,
            BulletQuery,
            ZombieQuery,
            WallQuery,
            ExpOrbQuery,
            DamageTextQuery,
        ]);

        const restart = builder.addSystem(Update.fixed, restartSystem, [
            InputService,
            CommandService,
            SpawnService,
            Write(GameState),
            GameEntityQuery,
        ]);
        const spawnWave = builder.addSystem(Update.fixed, spawnSystem, [
            GameConfigResource,
            TimeState,
            Write(GameState),
            RandomService,
            SpawnService,
        ]);
        const fire = builder.addSystem(Update.fixed, shooterFireSystem, [
            GameConfigResource,
            TimeState,
            SpawnService,
            GameState,
            ShooterQuery,
            ZombieQuery,
        ]);
        const moveBullets = builder.addSystem(Update.fixed, moveBulletsSystem, [
            GameConfigResource,
            TimeState,
            GameState,
            CommandService,
            BulletQuery,
        ]);
        const moveZombies = builder.addSystem(Update.fixed, moveZombiesSystem, [
            GameConfigResource,
            TimeState,
            GameState,
            CommandService,
            ZombieQuery,
        ]);
        const wallCollide = builder.addSystem(Update.fixed, zombieWallCollisionSystem, [
            GameConfigResource,
            Write(GameState),
            CommandService,
            ZombieQuery,
            WallQuery,
        ]);
        const bulletHit = builder.addSystem(Update.fixed, bulletZombieCollisionSystem, [
            GameConfigResource,
            Write(GameState),
            RandomService,
            CommandService,
            SpawnService,
            BulletQuery,
            ZombieQuery,
        ]);
        const collectXp = builder.addSystem(Update.fixed, expCollectSystem, [
            GameConfigResource,
            Write(GameState),
            CommandService,
            ExpOrbQuery,
            ShooterQuery,
        ]);
        const damageTexts = builder.addSystem(Update.fixed, damageTextUpdateSystem, [
            TimeState,
            GameState,
            CommandService,
            DamageTextQuery,
        ]);
        const levelUp = builder.addSystem(Update.fixed, levelUpSystem, [
            Write(GameState),
            RandomService,
            InputService,
            SpawnService,
            CommandService,
            GameEntityQuery,
            ShooterQuery,
        ]);
        const stats = builder.addSystem(Update.fixed, statisticsSystem, [
            Write(GameState),
            GameConfigResource,
            BulletQuery,
            ZombieQuery,
            ExpOrbQuery,
            GameEntityQuery,
        ]);

        builder.chain(
            restart,
            spawnWave,
            fire,
            moveBullets,
            moveZombies,
            wallCollide,
            bulletHit,
            collectXp,
            damageTexts,
            levelUp,
            stats,
        );
    }
}
