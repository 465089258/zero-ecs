import {
    Commands,
    defSystem,
    Startup,
    Update,
    Write,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { GameConfigResource, GameEntityQuery, GameMode, GameSessionState } from "../common";
import { InputService } from "../host";
import { Bullet, BulletQuery } from "../projectile";
import { ExpOrb, ExpOrbQuery, ProgressionState } from "../progression";
import { Zombie, ZombieQuery } from "../zombie";
import { GameContentService } from "./game-content-service";
import { GameplayStatisticsState, WaveState } from "./state";

type GameEntities = QueryOf<typeof GameEntityQuery>;
type Bullets = QueryOf<typeof BulletQuery>;
type Zombies = QueryOf<typeof ZombieQuery>;
type ExpOrbs = QueryOf<typeof ExpOrbQuery>;

/** 创建一局游戏的初始内容；渲染查询由 PresentationModule 自己绑定。 */
export const startupGameSystem = defSystem(Startup, startupGame, [
    GameContentService, Write(GameSessionState), Write(ProgressionState),
]);

/** Host → Gameplay：把宿主重开意图转换为完整的领域重置事务。 */
export const restartSystem = defSystem(Update.fixed, restartGame, [
    InputService, Commands, GameContentService, Write(GameSessionState),
    Write(ProgressionState), Write(WaveState), Write(GameplayStatisticsState), GameEntityQuery,
]);

/** 将多个叶子模块的实时数量汇总为供规则和表现读取的统计投影。 */
export const statisticsSystem = defSystem(Update.fixed, updateStatistics, [
    Write(GameSessionState), Write(WaveState), Write(GameplayStatisticsState),
    GameConfigResource, BulletQuery, ZombieQuery, ExpOrbQuery, GameEntityQuery,
]);

function startupGame(
    content: GameContentService,
    session: Mut<GameSessionState>,
    progression: Mut<ProgressionState>,
): void {
    session.skipTick = 1;
    progression.xpToNext = 50;
    content.spawnGame();
}

function restartGame(
    input: InputService,
    commands: Commands,
    content: GameContentService,
    session: Mut<GameSessionState>,
    progression: Mut<ProgressionState>,
    wave: Mut<WaveState>,
    statistics: Mut<GameplayStatisticsState>,
    entities: GameEntities,
): void {
    if (!input.consumeRestart()) return;
    const iter = entities.iter();
    while (iter.next()) {
        const [count, ids] = iter.current;
        for (let i = 0; i < count; i++) commands.entity(ids[i]).despawn().submit();
    }

    statistics.score = 0;
    statistics.zombies = 0;
    statistics.bullets = 0;
    statistics.expOrbs = 0;
    statistics.entities = 0;
    statistics.wallHp = 0;
    statistics.wallMaxHp = 0;

    wave.wave = 0;
    wave.waveTimer = 0;
    wave.spawnQueue = 0;
    wave.spawnTimer = 0;
    wave.baseZombieCount = 1;
    wave.pendingBaseGrowth = false;
    wave.inHorde = false;
    wave.waveZombieTotal = 0;

    progression.xp = 0;
    progression.xpToNext = 50;
    progression.level = 0;
    progression.damageLevel = 1;
    progression.attackSpeedLevel = 1;
    progression.scatterLevel = 1;
    progression.splitLevel = 0;
    progression.ricochetLevel = 1;
    progression.burstLevel = 1;
    progression.critChanceLevel = 1;
    progression.critDamageLevel = 1;
    progression.flatDamageLevel = 1;
    progression.damageMultiplierLevel = 1;
    progression.rebuildShooter = 0;
    progression.upgradeOptions = [];

    session.mode = GameMode.Playing;
    session.skipTick = 1;
    content.spawnGame();
}

function updateStatistics(
    session: Mut<GameSessionState>,
    wave: Mut<WaveState>,
    statistics: Mut<GameplayStatisticsState>,
    config: Readonly<GameConfigResource>,
    bullets: Bullets,
    zombies: Zombies,
    expOrbs: ExpOrbs,
    entities: GameEntities,
): void {
    statistics.bullets = countActiveBullets(bullets);
    statistics.zombies = countActiveZombies(zombies);
    statistics.expOrbs = countActiveExpOrbs(expOrbs);
    statistics.entities = countEntities(entities);
    if (statistics.wallMaxHp === 0) {
        statistics.wallHp = config.wallInitialHp;
        statistics.wallMaxHp = config.wallInitialHp;
    }

    if (wave.pendingBaseGrowth
        && wave.spawnQueue === 0
        && statistics.zombies <= wave.baseZombieCount * 0.5) {
        wave.baseZombieCount += config.baseZombieGrowth;
        wave.pendingBaseGrowth = false;
    }
    session.skipTick = 0;
}

function countActiveBullets(query: Bullets): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , , data] = iter.current;
        const active = data[Bullet.active];
        for (let i = 0; i < count; i++) total += active[i] !== 0 ? 1 : 0;
    }
    return total;
}

function countActiveZombies(query: Zombies): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , , data] = iter.current;
        const active = data[Zombie.active];
        for (let i = 0; i < count; i++) total += active[i] !== 0 ? 1 : 0;
    }
    return total;
}

function countActiveExpOrbs(query: ExpOrbs): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , , data] = iter.current;
        const active = data[ExpOrb.active];
        for (let i = 0; i < count; i++) total += active[i] !== 0 ? 1 : 0;
    }
    return total;
}

function countEntities(query: GameEntities): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) total += iter.current[0];
    return total;
}
