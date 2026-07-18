import { CommandService, type Entity, type Mut } from "zero-ecs-lib";
import { GameMode, GameState, WavePhase } from "../common/game-state";
import { WaveState } from "../zombie/wave-state";
import { ShooterState } from "../shooter/state";
import { GameConfig } from "../common/game-config";
import { ShooterConfig } from "../shooter/config";
import { WallConfig } from "../wall/config";
import { InputService } from "../common/input-service";
import { spawnShooter } from "../shooter/spawn";
import { spawnWall } from "../wall/spawn";
import { GameEntityQuery } from "./query";
import type { QueryOf } from "zero-ecs-lib";

type GameEntities = QueryOf<typeof GameEntityQuery>;

export function restartSystem(
    input: InputService, commands: CommandService,
    game: Mut<GameState>, wave: Mut<WaveState>, shooterSt: Mut<ShooterState>,
    gameCfg: Readonly<GameConfig>, shooterCfg: Readonly<ShooterConfig>, wallCfg: Readonly<WallConfig>,
    entities: GameEntities,
): void {
    if (!input.consumeRestart()) return;
    const iter = entities.iter();
    while (iter.next()) { const [count, ids] = iter.current; for (let i = 0; i < count; i++) commands.entity(ids[i] as Entity).despawn().submit(); }
    game.score = 0; game.xp = 0; game.xpToNext = 50; game.level = 0;
    game.zombies = 0; game.bullets = 0; game.expOrbs = 0; game.entities = 0;
    game.wallHp = 0; game.wallMaxHp = 0;
    game.mode = GameMode.Playing; game.skipTick = 1; game.upgradeOptions = [];
    wave.wave = 0; wave.waveBudget = 0; wave.wavePhase = WavePhase.Spawning;
    wave.restTimer = 0; wave.isBossWave = false; wave.spawnTimer = 0; wave.baseZombieCount = 1;
    shooterSt.damageLevel = 1; shooterSt.attackSpeedLevel = 1; shooterSt.scatterLevel = 1;
    shooterSt.splitLevel = 0; shooterSt.ricochetLevel = 1; shooterSt.burstLevel = 1;
    shooterSt.critChanceLevel = 1; shooterSt.critDamageLevel = 1;
    shooterSt.flatDamageLevel = 1; shooterSt.damageMultiplierLevel = 1;
    spawnShooter(commands, gameCfg, shooterCfg, shooterSt);
    spawnWall(commands, wallCfg);
}
