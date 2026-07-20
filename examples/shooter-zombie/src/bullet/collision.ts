import { CommandService, RandomService, type Entity, type Mut } from "zero-ecs-lib";
import { Bullet } from "./components";
import { Position, Velocity } from "../common/components";
import { Zombie } from "../zombie/components";
import { GameConfig } from "../common/game-config";
import { GameMode, GameState } from "../common/game-state";
import type { Bullets } from "./types";
import type { Zombies } from "../zombie/types";
import { spawnExpOrb } from "../exp-orb/spawn";
import { ExpOrbConfig } from "../exp-orb/config";
import { spawnDamageText } from "../damage-text/spawn";
import { spawnBullet } from "./spawn";
import { BulletConfig } from "./config";

export function bulletZombieCollisionSystem(
    config: Readonly<GameConfig>,
    bulletCfg: Readonly<BulletConfig>,
    orbCfg: Readonly<ExpOrbConfig>,
    game: Mut<GameState>,
    random: RandomService,
    commands: CommandService,
    bullets: Bullets,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    const zIter = zombies.iter();
    while (zIter.next()) {
        const [zCount, zEntities, zPositions, , zData] = zIter.current;
        const zXs = zPositions[Position.x]; const zYs = zPositions[Position.y];
        const zHp = zData[Zombie.hp]; const zXp = zData[Zombie.xp];
        const zReduction = zData[Zombie.damageReduction];
        const zActive = zData[Zombie.active];

        for (let zi = 0; zi < zCount; zi++) {
            if (zActive[zi] === 0) continue;
            const zx = zXs[zi]; const zy = zYs[zi];
            const zr = 14; // zombieRadius — could be from zombie config

            const bIter = bullets.iter();
            let bulletHit = false;
            while (!bulletHit && bIter.next()) {
                const [bCount, bEntities, bPositions, bVelocities, bData] = bIter.current;
                const bXs = bPositions[Position.x]; const bYs = bPositions[Position.y];
                const bActive = bData[Bullet.active]; const bDamage = bData[Bullet.damage];
                const bSplitCount = bData[Bullet.splitCount]; const bRicochetCounts = bData[Bullet.ricochetCount];
                const bIgnoreEntity = bData[Bullet.ignoreEntity];

                for (let bi = 0; bi < bCount; bi++) {
                    if (bActive[bi] === 0) continue;
                    if (bIgnoreEntity[bi] !== 0 && bIgnoreEntity[bi] === zEntities[zi]) continue;
                    const bx = bXs[bi]; const by = bYs[bi];
                    const br = bData[Bullet.radius][bi];
                    const dx = bx - zx; const dy = by - zy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > zr + br) continue;

                    const actualDmg = bDamage[bi] * (1 - zReduction[zi]);
                    zHp[zi] -= actualDmg;
                    game.score += 10;
                    spawnDamageText(commands, bx, by, Math.round(actualDmg), bData[Bullet.isCrit][bi]);

                    if (bSplitCount[bi] > 0) {
                        const bulletAngle = Math.atan2(bVelocities[Velocity.y][bi], bVelocities[Velocity.x][bi]);
                        const splitCount = bSplitCount[bi];
                        const spread = (Math.PI * 2) / splitCount;
                        const halfFan = (spread * (splitCount - 1)) / 2;
                        const spawnDist = zr + 8;
                        for (let s = 0; s < splitCount; s++) {
                            const angle = bulletAngle - halfFan + spread * s;
                            spawnBullet(commands, bulletCfg,
                                bx + Math.cos(angle) * spawnDist, by + Math.sin(angle) * spawnDist,
                                angle, actualDmg * 0.5, 0, bRicochetCounts[bi], zEntities[zi], 0);
                        }
                        bActive[bi] = 0;
                        commands.entity(bEntities[bi] as Entity).despawn().submit();
                    } else if (bRicochetCounts[bi] > 0) {
                        bRicochetCounts[bi]--;
                        bData[Bullet.lifetime][bi] += 0.5;
                        bIgnoreEntity[bi] = zEntities[zi];
                        const ricochetAngle = findRicochetTarget(bx, by, zXs, zYs, zActive, zCount, zi);
                        if (ricochetAngle !== null) {
                            const speed = bData[Bullet.speed][bi];
                            bVelocities[Velocity.x][bi] = Math.cos(ricochetAngle) * speed;
                            bVelocities[Velocity.y][bi] = Math.sin(ricochetAngle) * speed;
                        }
                    } else {
                        bActive[bi] = 0;
                        commands.entity(bEntities[bi] as Entity).despawn().submit();
                    }

                    if (zHp[zi] <= 0) {
                        zActive[zi] = 0;
                        commands.entity(zEntities[zi] as Entity).despawn().submit();
                        spawnExpOrb(commands, orbCfg, zx, zy, zXp[zi]);
                        game.score += 50;
                    }
                    bulletHit = true;
                    break;
                }
            }
        }
    }
}

function findRicochetTarget(
    fromX: number, fromY: number,
    zXs: Float32Array, zYs: Float32Array, zActive: Uint8Array,
    zCount: number, excludeIndex: number,
): number | null {
    let closestDist = Infinity, closestAngle = 0;
    for (let i = 0; i < zCount; i++) {
        if (zActive[i] === 0 || i === excludeIndex) continue;
        const dx = zXs[i] - fromX, dy = zYs[i] - fromY;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist && dist > 1) { closestDist = dist; closestAngle = Math.atan2(dy, dx); }
    }
    if (closestDist === Infinity) return null;
    return closestAngle;
}
