import {
    CommandService,
    defSystem,
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
import { SpawnService } from "../spawn/spawn-service";
import { Zombie } from "../zombie/components";
import { ZombieQuery } from "../zombie/queries";
import { Bullet } from "./components";
import { BulletQuery } from "./queries";

type Bullets = QueryOf<typeof BulletQuery>;
type Zombies = QueryOf<typeof ZombieQuery>;

export const moveBulletsSystem = defSystem(Update.fixed, moveBullets, [
    GameConfigResource, TimeState, GameState, CommandService, BulletQuery,
]);
export const bulletZombieCollisionSystem = defSystem(Update.fixed, collideBulletsAndZombies, [
    GameConfigResource, Write(GameState), CommandService, SpawnService, BulletQuery, ZombieQuery,
]);

function moveBullets(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: CommandService,
    bullets: Bullets,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const wallInset = 10;
    const iter = bullets.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, data] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const vxs = velocities[Velocity.x];
        const vys = velocities[Velocity.y];
        const ricochets = data[Bullet.ricochetCount];
        const lifetimes = data[Bullet.lifetime];
        const active = data[Bullet.active];
        const radii = data[Bullet.radius];

        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            let x = xs[i] + vxs[i] * time.delta;
            let y = ys[i] + vys[i] * time.delta;
            lifetimes[i] -= time.delta;

            let bounced = false;
            const radius = radii[i];
            if (x - radius < wallInset) {
                x = wallInset + radius;
                vxs[i] = Math.abs(vxs[i]);
                bounced = true;
            } else if (x + radius > config.width - wallInset) {
                x = config.width - wallInset - radius;
                vxs[i] = -Math.abs(vxs[i]);
                bounced = true;
            }
            if (y - radius < wallInset) {
                y = wallInset + radius;
                vys[i] = Math.abs(vys[i]);
                bounced = true;
            } else if (y + radius > config.height - wallInset) {
                y = config.height - wallInset - radius;
                vys[i] = -Math.abs(vys[i]);
                bounced = true;
            }

            if (bounced) {
                if (ricochets[i] > 0) {
                    ricochets[i]--;
                    lifetimes[i] += 0.5;
                } else {
                    active[i] = 0;
                    commands.entity(entities[i] as Entity).despawn().submit();
                    continue;
                }
            }
            xs[i] = x;
            ys[i] = y;
            if (lifetimes[i] <= 0) {
                active[i] = 0;
                commands.entity(entities[i] as Entity).despawn().submit();
            }
        }
    }
}

function collideBulletsAndZombies(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    commands: CommandService,
    spawn: SpawnService,
    bullets: Bullets,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    const zombieIter = zombies.iter();
    while (zombieIter.next()) {
        const [zombieCount, zombieEntities, zombiePositions, , zombieData] = zombieIter.current;
        const zombieXs = zombiePositions[Position.x];
        const zombieYs = zombiePositions[Position.y];
        const zombieHp = zombieData[Zombie.hp];
        const zombieXp = zombieData[Zombie.xp];
        const zombieActive = zombieData[Zombie.active];

        for (let zombieIndex = 0; zombieIndex < zombieCount; zombieIndex++) {
            if (zombieActive[zombieIndex] === 0) continue;
            const zombieX = zombieXs[zombieIndex];
            const zombieY = zombieYs[zombieIndex];
            const bulletIter = bullets.iter();
            let hit = false;

            while (!hit && bulletIter.next()) {
                const [bulletCount, bulletEntities, bulletPositions, bulletVelocities, bulletData] = bulletIter.current;
                const bulletXs = bulletPositions[Position.x];
                const bulletYs = bulletPositions[Position.y];
                const active = bulletData[Bullet.active];
                const damages = bulletData[Bullet.damage];
                const splitCounts = bulletData[Bullet.splitCount];
                const ricochets = bulletData[Bullet.ricochetCount];

                for (let bulletIndex = 0; bulletIndex < bulletCount; bulletIndex++) {
                    if (active[bulletIndex] === 0) continue;
                    const bulletX = bulletXs[bulletIndex];
                    const bulletY = bulletYs[bulletIndex];
                    const dx = bulletX - zombieX;
                    const dy = bulletY - zombieY;
                    const radius = config.zombieRadius + bulletData[Bullet.radius][bulletIndex];
                    if (Math.sqrt(dx * dx + dy * dy) > radius) continue;

                    zombieHp[zombieIndex] -= damages[bulletIndex];
                    game.score += 10;
                    spawn.spawnDamageText(bulletX, bulletY, Math.round(damages[bulletIndex]));

                    if (splitCounts[bulletIndex] > 0) {
                        spawnSplitBullets(
                            bulletX,
                            bulletY,
                            config.zombieRadius,
                            damages[bulletIndex],
                            splitCounts[bulletIndex],
                            ricochets[bulletIndex],
                            bulletVelocities[Velocity.x][bulletIndex],
                            bulletVelocities[Velocity.y][bulletIndex],
                            spawn,
                        );
                    }

                    if (ricochets[bulletIndex] > 0) {
                        ricochets[bulletIndex]--;
                        bulletData[Bullet.lifetime][bulletIndex] += 0.5;
                        const angle = findRicochetTarget(
                            bulletX,
                            bulletY,
                            zombieXs,
                            zombieYs,
                            zombieActive,
                            zombieCount,
                        );
                        if (angle !== null) {
                            const speed = bulletData[Bullet.speed][bulletIndex];
                            bulletVelocities[Velocity.x][bulletIndex] = Math.cos(angle) * speed;
                            bulletVelocities[Velocity.y][bulletIndex] = Math.sin(angle) * speed;
                        }
                    } else {
                        active[bulletIndex] = 0;
                        commands.entity(bulletEntities[bulletIndex] as Entity).despawn().submit();
                    }

                    if (zombieHp[zombieIndex] <= 0) {
                        zombieActive[zombieIndex] = 0;
                        commands.entity(zombieEntities[zombieIndex] as Entity).despawn().submit();
                        spawn.spawnExpOrb(zombieX, zombieY, zombieXp[zombieIndex]);
                        game.score += 50;
                    }
                    hit = true;
                    break;
                }
            }
        }
    }
}

function spawnSplitBullets(
    x: number,
    y: number,
    zombieRadius: number,
    damage: number,
    splitCount: number,
    ricochetCount: number,
    velocityX: number,
    velocityY: number,
    spawn: SpawnService,
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
        spawn.spawnBullet(
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
