import {
    Commands,
    defSystem,
    QueryType,
    RandomService,
    Update,
    With,
    Write,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import {
    AttributeChangeRequest,
    AttributeChangeRequestType,
    Health,
    HealthType,
} from "../attribute/components";
import { applyAttributeChangesSystem } from "../attribute/systems";
import { Position, PositionType, Velocity, VelocityType } from "../common/components";
import { GameMode, GameState } from "../common/game-state";
import { GameConfigResource } from "../common/resources";
import {
    DamageRequest,
    DamageRequestType,
    DamageResult,
} from "../damage/components";
import { DamageResultQuery } from "../damage/queries";
import { Bullet, BulletType } from "../projectile/components";
import { ShooterType, ShotRequest } from "../shooter/components";
import { ShooterQuery, ShotRequestQuery } from "../shooter/queries";
import { WallType, Zombie, ZombieType } from "../zombie/components";
import { ZombieQuery } from "../zombie/queries";
import { ProjectileDamagePayload, ProjectileDamagePayloadType } from "./components";
import { GameContentService } from "./game-content-service";

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

/** Shooter → Projectile：射手只表达射击意图，本系统负责目标选择和投射物组装。 */
export const shotToProjectileSystem = defSystem(Update.fixed, projectShotsToBullets, [
    Commands, RandomService, GameContentService, ShotRequestQuery, ZombieQuery,
]);

/** Projectile → Damage：碰撞只产生 DamageRequest，不修改目标生命值。 */
export const projectileDamageSystem = defSystem(Update.fixed, collideProjectiles, [
    GameConfigResource, Commands, GameContentService, DamageBulletQuery, ZombieHealthQuery,
]);

/** Zombie → Damage：僵尸攻击防线同样走统一的伤害输入契约。 */
export const zombieWallDamageSystem = defSystem(Update.fixed, requestWallDamage, [
    GameConfigResource, GameState, Commands, ZombieQuery, WallHealthQuery,
]);

/** Damage → Attribute：把结算结果投影成通用属性变化请求。 */
export const damageToAttributeSystem = defSystem(Update.fixed, projectDamageToAttributes, [
    Commands, DamageResultQuery,
]);

/** Damage → Presentation/Score：表现与计分订阅结果，不进入 Damage Core。 */
export const damageFeedbackSystem = defSystem(Update.fixed, createDamageFeedback, [
    Write(GameState), GameContentService, DamageResultQuery, ZombieQuery,
]);

export const damageResultCleanupSystem = defSystem(Update.fixed, cleanupDamageResults, [
    Commands, DamageResultQuery,
]);

/** Attribute/Zombie/Progression 集成：只有该系统知道“僵尸生命归零会掉经验”。 */
export const healthReactionSystem = defSystem(Update.fixed, reactToDepletedHealth, [
    Write(GameState), Commands, GameContentService, ZombieHealthQuery, WallHealthQuery,
]);

/** Progression → Shooter：升级只改变进度数据，本系统重建 Shooter 运行时投影。 */
export const rebuildShooterSystem = defSystem(Update.fixed, rebuildShooter, [
    Write(GameState), Commands, GameContentService, ShooterQuery,
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
        for (let i = 0; i < count; i++) {
            const x = data[ShotRequest.x][i];
            const y = data[ShotRequest.y][i];
            const baseAngle = findNearestZombieAngle(x, y, zombies);
            const scatter = data[ShotRequest.scatter][i];
            for (let index = 0; index < scatter; index++) {
                let angle = baseAngle;
                if (scatter > 1) angle += 0.12 * (index - (scatter - 1) * 0.5);
                const baseDamage = data[ShotRequest.damage][i];
                const critical = data[ShotRequest.critChance][i] > random.float();
                const damage = baseDamage
                    * (critical ? data[ShotRequest.critMultiplier][i] : 1)
                    * random.float(0.9, 1.1);
                content.spawnBullet(
                    x + 12,
                    y + index * 4 - scatter * 2,
                    angle,
                    damage,
                    data[ShotRequest.split][i],
                    data[ShotRequest.ricochet][i],
                );
            }
            commands.entity(entities[i] as Entity).despawn().submit();
        }
    }
}

function findNearestZombieAngle(x: number, y: number, zombies: Zombies): number {
    let closestDistance = Infinity;
    let closestAngle = 0;
    const iter = zombies.iter();
    while (iter.next()) {
        const [count, , positions, , data] = iter.current;
        for (let i = 0; i < count; i++) {
            if (data[Zombie.active][i] === 0) continue;
            const dx = positions[Position.x][i] - x;
            const dy = positions[Position.y][i] - y;
            const distance = dx * dx + dy * dy;
            if (distance < closestDistance) {
                closestDistance = distance;
                closestAngle = Math.atan2(dy, dx);
            }
        }
    }
    return closestAngle;
}

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
        for (let zombieIndex = 0; zombieIndex < zombieCount; zombieIndex++) {
            if (zombieData[Zombie.active][zombieIndex] === 0) continue;
            const zombieX = zombiePositions[Position.x][zombieIndex];
            const zombieY = zombiePositions[Position.y][zombieIndex];
            const bulletIter = bullets.iter();
            let hit = false;
            while (!hit && bulletIter.next()) {
                const [bulletCount, bulletEntities, positions, velocities, data, payload] = bulletIter.current;
                for (let bulletIndex = 0; bulletIndex < bulletCount; bulletIndex++) {
                    if (data[Bullet.active][bulletIndex] === 0) continue;
                    const bulletX = positions[Position.x][bulletIndex];
                    const bulletY = positions[Position.y][bulletIndex];
                    const dx = bulletX - zombieX;
                    const dy = bulletY - zombieY;
                    const radius = config.zombieRadius + data[Bullet.radius][bulletIndex];
                    if (dx * dx + dy * dy > radius * radius) continue;

                    submitDamage(
                        commands,
                        bulletEntities[bulletIndex] as Entity,
                        zombieEntities[zombieIndex] as Entity,
                        payload[ProjectileDamagePayload.amount][bulletIndex],
                        bulletX,
                        bulletY,
                    );
                    if (data[Bullet.splitCount][bulletIndex] > 0) {
                        spawnSplitBullets(
                            content,
                            bulletX,
                            bulletY,
                            config.zombieRadius,
                            payload[ProjectileDamagePayload.amount][bulletIndex],
                            data[Bullet.splitCount][bulletIndex],
                            data[Bullet.ricochetCount][bulletIndex],
                            velocities[Velocity.x][bulletIndex],
                            velocities[Velocity.y][bulletIndex],
                        );
                    }
                    if (data[Bullet.ricochetCount][bulletIndex] > 0) {
                        data[Bullet.ricochetCount][bulletIndex]--;
                        data[Bullet.lifetime][bulletIndex] += 0.5;
                        const angle = findRicochetTarget(
                            bulletX,
                            bulletY,
                            zombiePositions[Position.x],
                            zombiePositions[Position.y],
                            zombieData[Zombie.active],
                            zombieCount,
                        );
                        if (angle !== null) {
                            const speed = data[Bullet.speed][bulletIndex];
                            velocities[Velocity.x][bulletIndex] = Math.cos(angle) * speed;
                            velocities[Velocity.y][bulletIndex] = Math.sin(angle) * speed;
                        }
                    } else {
                        data[Bullet.active][bulletIndex] = 0;
                        commands.entity(bulletEntities[bulletIndex] as Entity).despawn().submit();
                    }
                    hit = true;
                    break;
                }
            }
        }
    }
}

function requestWallDamage(
    config: Readonly<GameConfigResource>,
    game: Readonly<GameState>,
    commands: Commands,
    zombies: Zombies,
    walls: WallHealthValues,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    let wall: Entity | undefined;
    let wallX = 0;
    let wallY = 0;
    const wallIter = walls.iter();
    while (wallIter.next()) {
        if (wallIter.current[0] === 0) continue;
        wall = wallIter.current[1][0] as Entity;
        wallX = wallIter.current[2][Position.x][0];
        wallY = wallIter.current[2][Position.y][0];
        break;
    }
    if (wall === undefined) return;

    let amount = 0;
    const zombieIter = zombies.iter();
    while (zombieIter.next()) {
        const [count, , positions, , data] = zombieIter.current;
        for (let i = 0; i < count; i++) {
            if (data[Zombie.active][i] !== 0
                && positions[Position.x][i] <= config.wallX + config.wallHalfWidth + config.zombieRadius + 1) {
                amount += data[Zombie.damage][i] * (1 / 120);
            }
        }
    }
    if (amount > 0) submitDamage(commands, 0 as Entity, wall, amount, wallX, wallY);
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

function projectDamageToAttributes(commands: Commands, results: DamageResults): void {
    const iter = results.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        for (let i = 0; i < count; i++) {
            commands.spawn()
                .add(AttributeChangeRequestType)
                .set(AttributeChangeRequestType, AttributeChangeRequest.target, data[DamageResult.target][i])
                .set(AttributeChangeRequestType, AttributeChangeRequest.amount, -data[DamageResult.final][i]).submit();
        }
    }
}

function createDamageFeedback(
    game: Mut<GameState>,
    content: GameContentService,
    results: DamageResults,
    zombies: Zombies,
): void {
    const iter = results.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        for (let i = 0; i < count; i++) {
            if (!containsEntity(zombies, data[DamageResult.target][i] as Entity)) continue;
            const amount = data[DamageResult.final][i];
            if (amount < 1) continue;
            game.score += 10;
            content.spawnDamageText(data[DamageResult.x][i], data[DamageResult.y][i], Math.round(amount));
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

function cleanupDamageResults(commands: Commands, results: DamageResults): void {
    const iter = results.iter();
    while (iter.next()) {
        const [count, entities] = iter.current;
        for (let i = 0; i < count; i++) commands.entity(entities[i] as Entity).despawn().submit();
    }
}

function reactToDepletedHealth(
    game: Mut<GameState>,
    commands: Commands,
    content: GameContentService,
    zombies: ZombieHealthValues,
    walls: WallHealthValues,
): void {
    const zombieIter = zombies.iter();
    while (zombieIter.next()) {
        const [count, entities, positions, , data, health] = zombieIter.current;
        for (let i = 0; i < count; i++) {
            if (data[Zombie.active][i] === 0 || health[Health.current][i] > 0) continue;
            data[Zombie.active][i] = 0;
            commands.entity(entities[i] as Entity).despawn().submit();
            content.spawnExpOrb(positions[Position.x][i], positions[Position.y][i], data[Zombie.xp][i]);
            game.score += 50;
        }
    }

    const wallIter = walls.iter();
    while (wallIter.next()) {
        const [count, entities, , , health] = wallIter.current;
        for (let i = 0; i < count; i++) {
            game.wallHp = Math.ceil(health[Health.current][i]);
            game.wallMaxHp = health[Health.max][i];
            if (health[Health.current][i] > 0) continue;
            commands.entity(entities[i] as Entity).despawn().submit();
            game.mode = GameMode.GameOver;
        }
    }
}

function rebuildShooter(
    game: Mut<GameState>,
    commands: Commands,
    content: GameContentService,
    shooters: QueryOf<typeof ShooterQuery>,
): void {
    if (game.rebuildShooter === 0) return;
    const iter = shooters.iter();
    while (iter.next()) {
        const [count, entities] = iter.current;
        for (let i = 0; i < count; i++) commands.entity(entities[i] as Entity).despawn().submit();
    }
    content.spawnShooter();
    game.rebuildShooter = 0;
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
): number | null {
    let closestDistance = Infinity;
    let closestAngle = 0;
    for (let i = 0; i < count; i++) {
        if (active[i] === 0) continue;
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
