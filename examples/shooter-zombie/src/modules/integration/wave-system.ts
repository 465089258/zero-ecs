import {
    defSystem,
    RandomService,
    TimeState,
    Update,
    Write,
    type Mut,
} from "@zero-ecs/game";
import { GameMode, GameState } from "../common/game-state";
import { GameConfigResource } from "../common/resources";
import { pickUpgrades } from "../common/upgrade-utils";
import { GameContentService } from "./game-content-service";

/** Wave/Content → Zombie：波次规则属于游戏集成层，而不是 Zombie Core。 */
export const waveSpawnSystem = defSystem(Update.fixed, spawnWaveContent, [
    GameConfigResource, TimeState, Write(GameState), RandomService, GameContentService,
]);

function spawnWaveContent(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Mut<GameState>,
    random: RandomService,
    content: GameContentService,
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
        content.spawnZombie(game.wave);
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
        content.spawnZombieAt(game.wave + 2, x, y);
    }
}
