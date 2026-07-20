import {
    Commands,
    defSystem,
    Startup,
    Update,
    Write,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { GameEntityQuery } from "../common/queries";
import { GameMode, GameState } from "../common/game-state";
import { GameConfigResource } from "../common/resources";
import { InputService } from "../common/services/input-service";
import { GameContentService } from "../integration/game-content-service";
import {
    PresentationWallQuery,
    PresentationZombieQuery,
    RendererService,
} from "../presentation/renderer-service";
import { Bullet } from "../projectile/components";
import { BulletQuery } from "../projectile/queries";
import { ExpOrb } from "../progression/components";
import { DamageTextQuery, ExpOrbQuery } from "../progression/queries";
import { ShooterQuery } from "../shooter/queries";
import { Zombie } from "../zombie/components";
import { ZombieQuery } from "../zombie/queries";

type GameEntities = QueryOf<typeof GameEntityQuery>;
type Bullets = QueryOf<typeof BulletQuery>;
type Zombies = QueryOf<typeof ZombieQuery>;
type ExpOrbs = QueryOf<typeof ExpOrbQuery>;

export const startupGameSystem = defSystem(Startup, startupGame, [
    GameContentService, RendererService, Write(GameState), ShooterQuery, BulletQuery,
    PresentationZombieQuery, PresentationWallQuery, ExpOrbQuery, DamageTextQuery,
]);
export const restartSystem = defSystem(Update.fixed, restartGame, [
    InputService, Commands, GameContentService, Write(GameState), GameEntityQuery,
]);
export const statisticsSystem = defSystem(Update.fixed, updateStatistics, [
    Write(GameState), GameConfigResource, BulletQuery, ZombieQuery, ExpOrbQuery, GameEntityQuery,
]);

function startupGame(
    spawn: GameContentService,
    renderer: RendererService,
    game: Mut<GameState>,
    shooter: QueryOf<typeof ShooterQuery>,
    bullets: Bullets,
    zombies: QueryOf<typeof PresentationZombieQuery>,
    walls: QueryOf<typeof PresentationWallQuery>,
    expOrbs: ExpOrbs,
    damageTexts: QueryOf<typeof DamageTextQuery>,
): void {
    renderer.bind(shooter, bullets, zombies, walls, expOrbs, damageTexts);
    game.skipTick = 1;
    game.xpToNext = 50;
    spawn.spawnGame();
}

function restartGame(
    input: InputService,
    commands: Commands,
    spawn: GameContentService,
    game: Mut<GameState>,
    entities: GameEntities,
): void {
    if (!input.consumeRestart()) return;
    const iter = entities.iter();
    while (iter.next()) {
        const [count, ids] = iter.current;
        for (let i = 0; i < count; i++) commands.entity(ids[i] as Entity).despawn().submit();
    }

    game.score = 0;
    game.wave = 0;
    game.waveTimer = 0;
    game.spawnQueue = 0;
    game.spawnTimer = 0;
    game.xp = 0;
    game.xpToNext = 50;
    game.level = 0;
    game.zombies = 0;
    game.bullets = 0;
    game.expOrbs = 0;
    game.entities = 0;
    game.damageLevel = 1;
    game.attackSpeedLevel = 1;
    game.scatterLevel = 1;
    game.splitLevel = 0;
    game.ricochetLevel = 1;
    game.burstLevel = 1;
    game.critChanceLevel = 1;
    game.critDamageLevel = 1;
    game.flatDamageLevel = 1;
    game.damageMultiplierLevel = 1;
    game.baseZombieCount = 1;
    game.pendingBaseGrowth = false;
    game.inHorde = false;
    game.waveZombieTotal = 0;
    game.wallHp = 0;
    game.wallMaxHp = 0;
    game.rebuildShooter = 0;
    game.mode = GameMode.Playing;
    game.skipTick = 1;
    game.upgradeOptions = [];
    spawn.spawnGame();
}

function updateStatistics(
    game: Mut<GameState>,
    config: Readonly<GameConfigResource>,
    bullets: Bullets,
    zombies: Zombies,
    expOrbs: ExpOrbs,
    entities: GameEntities,
): void {
    game.bullets = countActiveBullets(bullets);
    game.zombies = countActiveZombies(zombies);
    game.expOrbs = countActiveExpOrbs(expOrbs);
    game.entities = countEntities(entities);
    if (game.wallMaxHp === 0) game.wallMaxHp = 500;

    if (game.pendingBaseGrowth && game.spawnQueue === 0 && game.zombies <= game.baseZombieCount * 0.5) {
        game.baseZombieCount += config.baseZombieGrowth;
        game.pendingBaseGrowth = false;
    }
    game.skipTick = 0;
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
