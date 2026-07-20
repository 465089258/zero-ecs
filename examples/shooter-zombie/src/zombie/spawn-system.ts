import { CommandService, RandomService, TimeState, type Mut } from "zero-ecs-lib";
import { GameConfig } from "../common/game-config";
import { ZombieConfig } from "./config";
import { WaveConfig } from "./wave-config";
import { WaveState } from "./wave-state";
import { GameMode, GameState, UpgradeType, WavePhase } from "../common/game-state";
import { spawnZombie, spawnZombieAt } from "./spawn";

const ALL_UPGRADES: UpgradeType[] = [
    UpgradeType.Damage, UpgradeType.AttackSpeed, UpgradeType.Scatter,
    UpgradeType.Split, UpgradeType.Ricochet, UpgradeType.Burst,
    UpgradeType.CritChance, UpgradeType.CritDamage,
    UpgradeType.FlatDamage, UpgradeType.DamageMultiplier,
];

export function spawnSystem(
    gameCfg: Readonly<GameConfig>,
    cfg: Readonly<ZombieConfig>,
    waveCfg: Readonly<WaveConfig>,
    time: Readonly<TimeState>,
    game: Mut<GameState>,
    wave: Mut<WaveState>,
    random: RandomService,
    commands: CommandService,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    if (wave.wave === 0) { wave.wave++; wave.waveBudget = wave.baseZombieCount + wave.wave * waveCfg.zombiePerWaveGrowth; wave.wavePhase = WavePhase.Spawning; wave.isBossWave = wave.wave % waveCfg.bossWaveInterval === 0; return; }
    switch (wave.wavePhase) {
        case WavePhase.Spawning:
            wave.spawnTimer -= time.delta;
            if (wave.spawnTimer <= 0 && wave.waveBudget > 0 && game.zombies < gameCfg.maxZombies) {
                const minD = Math.max(0.15, waveCfg.spawnDelayMin - wave.wave * 0.005);
                const maxD = Math.max(0.4, waveCfg.spawnDelayMax - wave.wave * 0.01);
                wave.spawnTimer = random.float(minD, maxD);
                const groupSize = Math.min(Math.ceil(wave.wave / 2), wave.waveBudget, gameCfg.maxZombies - game.zombies);
                for (let g = 0; g < groupSize; g++) { spawnZombie(commands, random, gameCfg, cfg, wave.wave); wave.waveBudget--; }
            }
            if (wave.waveBudget <= 0) wave.wavePhase = WavePhase.Fighting;
            break;
        case WavePhase.Fighting:
            if (game.zombies > 0) return;
            if (wave.isBossWave) {
                const hc = Math.round(wave.waveBudget * waveCfg.bossWaveMultiplier) + wave.baseZombieCount + wave.wave * waveCfg.zombiePerWaveGrowth;
                const count = Math.min(hc, gameCfg.maxZombies);
                const yMin = gameCfg.zombieSpawnYMin + 20; const yMax = gameCfg.zombieSpawnYMax - 20;
                for (let i = 0; i < count; i++) {
                    const x = gameCfg.zombieSpawnX - random.float(0, 60);
                    const y = count > 1 ? yMin + (yMax - yMin) * (i / (count - 1)) + random.float(-15, 15) : yMin + (yMax - yMin) * 0.5;
                    spawnZombieAt(commands, cfg, wave.wave + 2, x, y);
                }
                wave.waveBudget = count; wave.wavePhase = WavePhase.Horde;
            } else { wave.restTimer = waveCfg.restTime; wave.wavePhase = WavePhase.Resting; }
            break;
        case WavePhase.Horde:
            if (game.zombies > 0) return;
            game.level++; game.xpToNext = Math.floor(50 + game.level * 45 + game.level * game.level * 5);
            game.upgradeOptions = pickUpgrades(random, 3); game.mode = GameMode.LevelUp;
            wave.baseZombieCount += waveCfg.baseZombieGrowth;
            wave.restTimer = waveCfg.restTime; wave.wavePhase = WavePhase.Resting;
            break;
        case WavePhase.Resting:
            wave.restTimer -= time.delta;
            if (wave.restTimer <= 0) { wave.wave++; wave.waveBudget = wave.baseZombieCount + wave.wave * waveCfg.zombiePerWaveGrowth; wave.wavePhase = WavePhase.Spawning; wave.isBossWave = wave.wave % waveCfg.bossWaveInterval === 0; }
            break;
    }
}

function pickUpgrades(random: RandomService, count: number): UpgradeType[] {
    const pool = [...ALL_UPGRADES]; const result: UpgradeType[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) { const idx = random.int(0, pool.length - 1); result.push(pool[idx]); pool.splice(idx, 1); }
    return result;
}
