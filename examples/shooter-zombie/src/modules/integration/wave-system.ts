import {
    defSystem,
    RandomService,
    TimeState,
    Update,
    Write,
    type Mut,
} from "@zero-ecs/game";
import { GameConfigResource, GameMode, GameSessionState } from "../common";
import { pickUpgrades, ProgressionState } from "../progression";
import { GameContentService } from "./game-content-service";
import { GameplayStatisticsState, WaveState } from "./state";

/** Wave/Content → Zombie：波次规则属于游戏集成层，而不是 Zombie Core。 */
export const waveSpawnSystem = defSystem(Update.fixed, spawnWaveContent, [
    GameConfigResource, TimeState, Write(GameSessionState), Write(WaveState),
    Write(ProgressionState), GameplayStatisticsState, RandomService, GameContentService,
]);

function spawnWaveContent(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    session: Mut<GameSessionState>,
    wave: Mut<WaveState>,
    progression: Mut<ProgressionState>,
    statistics: Readonly<GameplayStatisticsState>,
    random: RandomService,
    content: GameContentService,
): void {
    if (session.skipTick || session.mode !== GameMode.Playing) return;
    const knownZombies = statistics.zombies + wave.spawnQueue;
    if (wave.wave === 0) {
        wave.wave = 1;
        wave.waveTimer = config.waveInterval;
        wave.waveDuration = config.waveInterval;
    }
    if (wave.inHorde) {
        // 僵尸通过 Update.post 的结构命令物化；先跨过一次统计 Tick，避免用旧的 0 计数误判清场。
        if (wave.spawnQueue > 0) {
            wave.spawnQueue = 0;
            return;
        }
        if (statistics.zombies === 0) {
            wave.inHorde = false;
            wave.wave++;
            wave.waveTimer = Math.max(4, config.waveInterval - wave.wave * 0.08);
            wave.waveDuration = wave.waveTimer;
            progression.level++;
            progression.xpToNext = Math.floor(
                50 + progression.level * 45 + progression.level * progression.level * 5,
            );
            progression.upgradeOptions = pickUpgrades(random, 3);
            session.mode = GameMode.LevelUp;
        }
        return;
    }
    // 普通波次中，上一个 Tick 排队的实体此时已经物化，但 statistics 尚未刷新计数。
    wave.spawnQueue = 0;

    wave.waveTimer -= time.delta;
    wave.spawnTimer -= time.delta;
    let queuedThisTick = 0;
    if (wave.spawnTimer <= 0 && knownZombies < config.maxZombies) {
        const minDelay = Math.max(0.15, config.spawnDelayMin - wave.wave * 0.005);
        const maxDelay = Math.max(0.4, config.spawnDelayMax - wave.wave * 0.01);
        wave.spawnTimer = random.float(minDelay, maxDelay);
        content.spawnZombie(wave.wave);
        queuedThisTick++;
    }
    if (wave.waveTimer > 0) {
        wave.spawnQueue = queuedThisTick;
        return;
    }

    wave.inHorde = true;
    const isBossWave = wave.wave % config.bossWaveInterval === 0;
    let hordeCount = wave.baseZombieCount * 3 + wave.wave * 3;
    if (isBossWave) {
        hordeCount = Math.floor(hordeCount * config.bossWaveMultiplier);
        wave.pendingBaseGrowth = true;
    }
    hordeCount = Math.min(
        hordeCount,
        Math.max(0, config.maxZombies - knownZombies - queuedThisTick),
    );
    wave.spawnQueue = queuedThisTick + hordeCount;
    wave.waveZombieTotal = knownZombies + wave.spawnQueue;

    const yMin = config.zombieSpawnYMin + 20;
    const yMax = config.zombieSpawnYMax - 20;
    for (let i = 0; i < hordeCount; i++) {
        const x = config.zombieSpawnX - random.float(60);
        const y = hordeCount > 1
            ? yMin + (yMax - yMin) * (i / (hordeCount - 1)) + random.float(-15, 15)
            : yMin + (yMax - yMin) * 0.5;
        content.spawnZombieAt(wave.wave + 2, x, y);
    }
}
