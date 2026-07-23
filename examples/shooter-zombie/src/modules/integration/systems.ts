import {
    Commands,
    defSystem,
    INVALID_ENTITY,
    QueryType,
    Update,
    With,
    Write,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { RandomService } from "@zero-ecs/game/random";
import { TimeState } from "@zero-ecs/game/time";
import {
    AttributeChangeRequest,
    AttributeChangeRequestType,
    Health,
    HealthType,
} from "../attribute";
import {
    Float2, GameConfigResource, GameMode, GameSessionState, PositionType, VelocityType,
} from "../common";
import {
    DamageRequest,
    DamageRequestType,
    DamageResult,
    DamageResultQuery,
} from "../damage";
import { Bullet, BulletType } from "../projectile";
import { ProgressionState } from "../progression";
import { ShooterQuery, ShooterType, ShotRequest, ShotRequestQuery } from "../shooter";
import { WallType, Zombie, ZombieQuery, ZombieType } from "../zombie";
import { ProjectileDamagePayload, ProjectileDamagePayloadType } from "./components";
import { GameContentService } from "./game-content-service";
import { GameplayStatisticsState } from "./state";

const DamageBulletQuery = QueryType.from(With(
    PositionType,
    VelocityType,
    BulletType,
    ProjectileDamagePayloadType,
));
const ZombieHealthQuery = QueryType.from(With(PositionType, VelocityType, ZombieType, HealthType));
const WallHealthQuery = QueryType.from(With(PositionType, WallType, HealthType));

type Shots = QueryOf<typeof ShotRequestQuery>;
type Zombies = QueryOf<typeof ZombieQuery>;
type DamageBullets = QueryOf<typeof DamageBulletQuery>;
type ZombieHealthValues = QueryOf<typeof ZombieHealthQuery>;
type WallHealthValues = QueryOf<typeof WallHealthQuery>;
type DamageResults = QueryOf<typeof DamageResultQuery>;

/** Progression → Shooter：升级只改变进度数据，本系统重建 Shooter 运行时投影。 */
export const rebuildShooterSystem = defSystem(Update.fixed, rebuildShooter, [
    Write(ProgressionState), Commands, GameContentService, ShooterQuery,
]);

/** Shooter → Projectile：射手只表达射击意图，本系统负责目标选择和投射物组装。 */
export const shotToProjectileSystem = defSystem(Update.fixed, projectShotsToBullets, [
    Commands, RandomService, GameContentService, ShotRequestQuery, ZombieQuery,
]);
function projectShotsToBullets(
    commands: Commands,
    random: RandomService,
    content: GameContentService,
    shots: Shots,
    zombies: Zombies,
): void {
    const iter = shots.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const xs = data[ShotRequest.x];
        const ys = data[ShotRequest.y];
        const damages = data[ShotRequest.damage];
        const critChances = data[ShotRequest.critChance];
        const critMultipliers = data[ShotRequest.critMultiplier];
        const scatters = data[ShotRequest.scatter];
        const splits = data[ShotRequest.split];
        const ricochets = data[ShotRequest.ricochet];
        for (let i = 0; i < count; i++) {
            const x = xs[i];
            const y = ys[i];
            const baseAngle = findNearestZombieAngle(x, y, zombies);
            const scatter = scatters[i];
            for (let index = 0; index < scatter; index++) {
                let angle = baseAngle;
                if (scatter > 1) angle += 0.12 * (index - (scatter - 1) * 0.5);
                const baseDamage = damages[i];
                const critical = critChances[i] > random.float();
                const damage = baseDamage
                    * (critical ? critMultipliers[i] : 1)
                    * random.float(0.9, 1.1);
                content.spawnBullet(
                    x + 12,
                    y + index * 4 - scatter * 2,
                    angle,
                    damage,
                    splits[i],
                    ricochets[i],
                );
            }
            commands.entity(entities[i]).despawn().submit();
        }
    }
}

function findNearestZombieAngle(x: number, y: number, zombies: Zombies): number {
    let closestDistance = Infinity;
    let closestAngle = 0;
    const iter = zombies.iter();
    while (iter.next()) {
        const [count, , positions, , data] = iter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        const active = data[Zombie.active];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            const dx = xs[i] - x;
            const dy = ys[i] - y;
            const distance = dx * dx + dy * dy;
            if (distance < closestDistance) {
                closestDistance = distance;
                closestAngle = Math.atan2(dy, dx);
            }
        }
    }
    return closestAngle;
}

/** Projectile → Damage：碰撞只产生 DamageRequest，不修改目标生命值。 */
export const projectileDamageSystem = defSystem(Update.fixed, collideProjectiles, [
    GameConfigResource, Commands, GameContentService, DamageBulletQuery, ZombieHealthQuery,
]);
function collideProjectiles(
    config: Readonly<GameConfigResource>,
    commands: Commands,
    content: GameContentService,
    bullets: DamageBullets,
    zombies: ZombieHealthValues,
): void {
    const zombieIter = zombies.iter();
    while (zombieIter.next()) {
        const [zombieCount, zombieEntities, zombiePositions, , zombieData] = zombieIter.current;
        const zombieXs = zombiePositions[Float2.x];
        const zombieYs = zombiePositions[Float2.y];
        const zombieActive = zombieData[Zombie.active];
        for (let zombieIndex = 0; zombieIndex < zombieCount; zombieIndex++) {
            if (zombieActive[zombieIndex] === 0) continue;
            const zombieX = zombieXs[zombieIndex];
            const zombieY = zombieYs[zombieIndex];
            const bulletIter = bullets.iter();
            let hit = false;
            while (!hit && bulletIter.next()) {
                const [bulletCount, bulletEntities, positions, velocities, data, payload] = bulletIter.current;
                const bulletXs = positions[Float2.x];
                const bulletYs = positions[Float2.y];
                const velocityXs = velocities[Float2.x];
                const velocityYs = velocities[Float2.y];
                const active = data[Bullet.active];
                const radii = data[Bullet.radius];
                const damages = payload[ProjectileDamagePayload.amount];
                const splitCounts = data[Bullet.splitCount];
                const ricochetCounts = data[Bullet.ricochetCount];
                const lifetimes = data[Bullet.lifetime];
                const speeds = data[Bullet.speed];
                for (let bulletIndex = 0; bulletIndex < bulletCount; bulletIndex++) {
                    if (active[bulletIndex] === 0) continue;
                    const bulletX = bulletXs[bulletIndex];
                    const bulletY = bulletYs[bulletIndex];
                    const dx = bulletX - zombieX;
                    const dy = bulletY - zombieY;
                    const radius = config.zombieRadius + radii[bulletIndex];
                    if (dx * dx + dy * dy > radius * radius) continue;

                    submitDamage(
                        commands,
                        bulletEntities[bulletIndex],
                        zombieEntities[zombieIndex],
                        damages[bulletIndex],
                        bulletX,
                        bulletY,
                    );
                    if (splitCounts[bulletIndex] > 0) {
                        spawnSplitBullets(
                            content,
                            bulletX,
                            bulletY,
                            config.zombieRadius,
                            damages[bulletIndex],
                            splitCounts[bulletIndex],
                            ricochetCounts[bulletIndex],
                            velocityXs[bulletIndex],
                            velocityYs[bulletIndex],
                        );
                    }
                    if (ricochetCounts[bulletIndex] > 0) {
                        ricochetCounts[bulletIndex]--;
                        lifetimes[bulletIndex] += 0.5;
                        const angle = findRicochetTarget(
                            bulletX,
                            bulletY,
                            zombieXs,
                            zombieYs,
                            zombieActive,
                            zombieCount,
                            zombieIndex,
                        );
                        if (angle !== null) {
                            const speed = speeds[bulletIndex];
                            velocityXs[bulletIndex] = Math.cos(angle) * speed;
                            velocityYs[bulletIndex] = Math.sin(angle) * speed;
                        }
                    } else {
                        active[bulletIndex] = 0;
                        commands.entity(bulletEntities[bulletIndex]).despawn().submit();
                    }
                    hit = true;
                    break;
                }
            }
        }
    }
}

/** Zombie → Damage：僵尸攻击防线同样走统一的伤害输入契约。 */
export const zombieWallDamageSystem = defSystem(Update.fixed, requestWallDamage, [
    GameConfigResource, TimeState, GameSessionState, Commands, ZombieQuery, WallHealthQuery,
]);
function requestWallDamage(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    session: Readonly<GameSessionState>,
    commands: Commands,
    zombies: Zombies,
    walls: WallHealthValues,
): void {
    if (session.skipTick || session.mode !== GameMode.Playing) return;
    let wall: Entity | undefined;
    let wallX = 0;
    let wallY = 0;
    const wallIter = walls.iter();
    while (wallIter.next()) {
        if (wallIter.current[0] === 0) continue;
        const positions = wallIter.current[2];
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        wall = wallIter.current[1][0];
        wallX = xs[0];
        wallY = ys[0];
        break;
    }
    if (wall === undefined) return;

    let amount = 0;
    const zombieIter = zombies.iter();
    while (zombieIter.next()) {
        const [count, , positions, , data] = zombieIter.current;
        const xs = positions[Float2.x];
        const active = data[Zombie.active];
        const damages = data[Zombie.damage];
        for (let i = 0; i < count; i++) {
            if (active[i] !== 0
                && xs[i] <= config.wallX + config.wallHalfWidth + config.zombieRadius + 1) {
                amount += damages[i] * time.delta;
            }
        }
    }
    if (amount > 0) submitDamage(commands, INVALID_ENTITY, wall, amount, wallX, wallY);
}

function submitDamage(
    commands: Commands,
    source: Entity,
    target: Entity,
    amount: number,
    x: number,
    y: number,
): void {
    commands.spawn()
        .add(DamageRequestType)
        .set(DamageRequestType, DamageRequest.source, source)
        .set(DamageRequestType, DamageRequest.target, target)
        .set(DamageRequestType, DamageRequest.amount, amount)
        .set(DamageRequestType, DamageRequest.x, x)
        .set(DamageRequestType, DamageRequest.y, y).submit();
}

/** Damage → Attribute：把结算结果投影成通用属性变化请求。 */
export const damageToAttributeSystem = defSystem(Update.fixed, projectDamageToAttributes, [
    Commands, DamageResultQuery,
]);
function projectDamageToAttributes(commands: Commands, results: DamageResults): void {
    const iter = results.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        const targets = data[DamageResult.target];
        const finalAmounts = data[DamageResult.final];
        for (let i = 0; i < count; i++) {
            commands.spawn()
                .add(AttributeChangeRequestType)
                .set(AttributeChangeRequestType, AttributeChangeRequest.target, targets[i])
                .set(AttributeChangeRequestType, AttributeChangeRequest.amount, -finalAmounts[i]).submit();
        }
    }
}

/** Damage → Presentation/Score：表现与计分订阅结果，不进入 Damage Core。 */
export const damageFeedbackSystem = defSystem(Update.fixed, createDamageFeedback, [
    Write(GameplayStatisticsState), GameContentService, DamageResultQuery, ZombieQuery,
]);
function createDamageFeedback(
    statistics: Mut<GameplayStatisticsState>,
    content: GameContentService,
    results: DamageResults,
    zombies: Zombies,
): void {
    const iter = results.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        const targets = data[DamageResult.target];
        const finalAmounts = data[DamageResult.final];
        const xs = data[DamageResult.x];
        const ys = data[DamageResult.y];
        for (let i = 0; i < count; i++) {
            if (!containsEntity(zombies, targets[i])) continue;
            const amount = finalAmounts[i];
            if (amount < 1) continue;
            statistics.score += 10;
            content.spawnDamageText(xs[i], ys[i], Math.round(amount));
        }
    }
}

function containsEntity(query: Zombies, target: Entity): boolean {
    const iter = query.iter();
    while (iter.next()) {
        const [count, entities] = iter.current;
        for (let i = 0; i < count; i++) {
            if (entities[i] === target) return true;
        }
    }
    return false;
}

export const damageResultCleanupSystem = defSystem(Update.fixed, cleanupDamageResults, [
    Commands, DamageResultQuery,
]);
function cleanupDamageResults(commands: Commands, results: DamageResults): void {
    const iter = results.iter();
    while (iter.next()) {
        const [count, entities] = iter.current;
        for (let i = 0; i < count; i++) commands.entity(entities[i]).despawn().submit();
    }
}

/** Attribute/Zombie/Progression 集成：只有该系统知道“僵尸生命归零会掉经验”。 */
export const healthReactionSystem = defSystem(Update.fixed, reactToDepletedHealth, [
    Write(GameSessionState), Write(GameplayStatisticsState), Commands,
    GameContentService, ZombieHealthQuery, WallHealthQuery,
]);
function reactToDepletedHealth(
    session: Mut<GameSessionState>,
    statistics: Mut<GameplayStatisticsState>,
    commands: Commands,
    content: GameContentService,
    zombies: ZombieHealthValues,
    walls: WallHealthValues,
): void {
    const zombieIter = zombies.iter();
    while (zombieIter.next()) {
        const [count, entities, positions, , data, health] = zombieIter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        const active = data[Zombie.active];
        const experience = data[Zombie.xp];
        const currentHealth = health[Health.current];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0 || currentHealth[i] > 0) continue;
            active[i] = 0;
            commands.entity(entities[i]).despawn().submit();
            content.spawnExpOrb(xs[i], ys[i], experience[i]);
            statistics.score += 50;
        }
    }

    const wallIter = walls.iter();
    while (wallIter.next()) {
        const [count, entities, , , health] = wallIter.current;
        const currentHealth = health[Health.current];
        const maxHealth = health[Health.max];
        for (let i = 0; i < count; i++) {
            statistics.wallHp = Math.ceil(currentHealth[i]);
            statistics.wallMaxHp = maxHealth[i];
            if (currentHealth[i] > 0) continue;
            commands.entity(entities[i]).despawn().submit();
            session.mode = GameMode.GameOver;
        }
    }
}

function rebuildShooter(
    progression: Mut<ProgressionState>,
    commands: Commands,
    content: GameContentService,
    shooters: QueryOf<typeof ShooterQuery>,
): void {
    if (progression.rebuildShooter === 0) return;
    const iter = shooters.iter();
    while (iter.next()) {
        const [count, entities] = iter.current;
        for (let i = 0; i < count; i++) commands.entity(entities[i]).despawn().submit();
    }
    content.spawnShooter();
    progression.rebuildShooter = 0;
}

function spawnSplitBullets(
    content: GameContentService,
    x: number,
    y: number,
    zombieRadius: number,
    damage: number,
    splitCount: number,
    ricochetCount: number,
    velocityX: number,
    velocityY: number,
): void {
    const baseAngle = Math.atan2(velocityY, velocityX);
    const totalSpread = Math.PI / 6;
    const spread = totalSpread * splitCount > Math.PI * 2
        ? Math.PI * 2 / splitCount
        : totalSpread / Math.max(1, splitCount - 1);
    const halfFan = spread * (splitCount - 1) / 2;
    const spawnDistance = zombieRadius + 8;
    for (let i = 0; i < splitCount; i++) {
        const angle = baseAngle - halfFan + spread * i;
        content.spawnBullet(
            x + Math.cos(angle) * spawnDistance,
            y + Math.sin(angle) * spawnDistance,
            angle,
            damage * 0.5,
            0,
            ricochetCount,
        );
    }
}

function findRicochetTarget(
    fromX: number,
    fromY: number,
    xs: Float32Array,
    ys: Float32Array,
    active: Uint8Array,
    count: number,
    ignoredIndex: number,
): number | null {
    let closestDistance = Infinity;
    let closestAngle = 0;
    for (let i = 0; i < count; i++) {
        if (i === ignoredIndex || active[i] === 0) continue;
        const dx = xs[i] - fromX;
        const dy = ys[i] - fromY;
        const distance = dx * dx + dy * dy;
        if (distance < closestDistance && distance > 1) {
            closestDistance = distance;
            closestAngle = Math.atan2(dy, dx);
        }
    }
    return closestDistance === Infinity ? null : closestAngle;
}
