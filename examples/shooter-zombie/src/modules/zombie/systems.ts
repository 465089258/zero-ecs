import {
    CommandService,
    defSystem,
    RandomService,
    TimeState,
    Update,
    Write,
    type Entity,
    type Mut,
    type QueryOf,
} from "zero-ecs-lib";
import { Position, Velocity } from "../common/components";
import { GameMode, GameState } from "../common/game-state";
import { GameConfigResource } from "../common/resources";
import { pickUpgrades } from "../common/upgrade-utils";
import { SpawnService } from "../spawn/spawn-service";
import { Wall, Zombie } from "./components";
import { WallQuery, ZombieQuery } from "./queries";

type Zombies = QueryOf<typeof ZombieQuery>;
type Walls = QueryOf<typeof WallQuery>;

export const spawnSystem = defSystem(Update.fixed, spawnZombies, [
    GameConfigResource, TimeState, Write(GameState), RandomService, SpawnService,
]);
export const moveZombiesSystem = defSystem(Update.fixed, moveZombies, [
    GameConfigResource, TimeState, GameState, ZombieQuery,
]);
export const zombieWallCollisionSystem = defSystem(Update.fixed, collideZombiesWithWall, [
    GameConfigResource, Write(GameState), CommandService, ZombieQuery, WallQuery,
]);

function spawnZombies(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Mut<GameState>,
    random: RandomService,
    spawn: SpawnService,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    if (game.wave === 0) {
        game.wave = 1;
        game.waveTimer = config.waveInterval;
        game.waveDuration = config.waveInterval;
    }

    if (game.inHorde) {
        if (game.zombies === 0) {
            game.inHorde = false;
            game.wave++;
            game.waveTimer = Math.max(4, config.waveInterval - game.wave * 0.08);
            game.waveDuration = game.waveTimer;
            game.level++;
            game.xpToNext = Math.floor(50 + game.level * 45 + game.level * game.level * 5);
            game.upgradeOptions = pickUpgrades(random, 3);
            game.mode = GameMode.LevelUp;
        }
        return;
    }

    game.waveTimer -= time.delta;
    game.spawnTimer -= time.delta;
    if (game.spawnTimer <= 0 && game.zombies < config.maxZombies) {
        const minDelay = Math.max(0.15, config.spawnDelayMin - game.wave * 0.005);
        const maxDelay = Math.max(0.4, config.spawnDelayMax - game.wave * 0.01);
        game.spawnTimer = random.float(minDelay, maxDelay);
        spawn.spawnZombie(game.wave);
    }

    if (game.waveTimer > 0) return;
    game.inHorde = true;
    const isBossWave = game.wave % config.bossWaveInterval === 0;
    let hordeCount = game.baseZombieCount * 3 + game.wave * 3;
    if (isBossWave) {
        hordeCount = Math.floor(hordeCount * config.bossWaveMultiplier);
        game.pendingBaseGrowth = true;
    }
    hordeCount = Math.min(hordeCount, config.maxZombies - game.zombies);
    game.waveZombieTotal = game.zombies + hordeCount;

    const yMin = config.zombieSpawnYMin + 20;
    const yMax = config.zombieSpawnYMax - 20;
    for (let i = 0; i < hordeCount; i++) {
        const x = config.zombieSpawnX - random.float(60);
        const y = hordeCount > 1
            ? yMin + (yMax - yMin) * (i / (hordeCount - 1)) + random.float(-15, 15)
            : yMin + (yMax - yMin) * 0.5;
        spawn.spawnZombieAt(game.wave + 2, x, y);
    }
}

function moveZombies(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = zombies.iter();
    while (iter.next()) {
        const [count, , positions, velocities, data] = iter.current;
        const xs = positions[Position.x];
        const vxs = velocities[Velocity.x];
        const active = data[Zombie.active];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            xs[i] += vxs[i] * time.delta;
            if (xs[i] <= config.wallX + config.wallHalfWidth + config.zombieRadius) {
                xs[i] = config.wallX + config.wallHalfWidth + config.zombieRadius;
                vxs[i] = 0;
            }
        }
    }
}

function collideZombiesWithWall(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    commands: CommandService,
    zombies: Zombies,
    walls: Walls,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    let wallEntity: Entity | null = null;
    let wallHp = 0;
    let wallMaxHp = 0;
    const wallIter = walls.iter();
    while (wallIter.next()) {
        const [count, entities, , data] = wallIter.current;
        if (count === 0) continue;
        wallEntity = entities[0] as Entity;
        wallHp = data[Wall.hp][0];
        wallMaxHp = data[Wall.maxHp][0];
    }
    if (wallEntity === null || wallHp <= 0) return;

    let currentHp = wallHp;
    const zombieIter = zombies.iter();
    while (zombieIter.next()) {
        const [count, , positions, , data] = zombieIter.current;
        const xs = positions[Position.x];
        const active = data[Zombie.active];
        const damages = data[Zombie.damage];
        for (let i = 0; i < count; i++) {
            if (active[i] !== 0 && xs[i] <= config.wallX + config.wallHalfWidth + config.zombieRadius + 1) {
                currentHp -= damages[i] * (1 / 120);
            }
        }
    }

    const updateIter = walls.iter();
    while (updateIter.next()) updateIter.current[3][Wall.hp][0] = Math.max(0, currentHp);

    if (currentHp <= 0) {
        commands.entity(wallEntity).despawn().submit();
        game.mode = GameMode.GameOver;
    }
    game.wallHp = Math.ceil(Math.max(0, currentHp));
    game.wallMaxHp = wallMaxHp;
}
