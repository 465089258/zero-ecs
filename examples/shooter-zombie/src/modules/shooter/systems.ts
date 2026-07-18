import { defSystem, RandomService, TimeState, Update, type QueryOf } from "zero-ecs-lib";
import { Position } from "../common/components";
import { GameMode, GameState } from "../common/game-state";
import { GameConfigResource } from "../common/resources";
import { SpawnService } from "../spawn/spawn-service";
import { Zombie } from "../zombie/components";
import { ZombieQuery } from "../zombie/queries";
import { Shooter } from "./components";
import { ShooterQuery } from "./queries";

type Shooters = QueryOf<typeof ShooterQuery>;
type Zombies = QueryOf<typeof ZombieQuery>;

export const shooterFireSystem = defSystem(Update.fixed, fireShooter, [
    GameConfigResource, TimeState, RandomService, SpawnService, GameState, ShooterQuery, ZombieQuery,
]);

function fireShooter(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    random: RandomService,
    spawn: SpawnService,
    game: Readonly<GameState>,
    shooter: Shooters,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = shooter.iter();
    while (iter.next()) {
        const [count, , positions, shooters] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const fireTimers = shooters[Shooter.fireTimer];
        const fireIntervals = shooters[Shooter.fireInterval];
        const damages = shooters[Shooter.damage];
        const critChances = shooters[Shooter.critChance];
        const critMults = shooters[Shooter.critMult];
        const scatters = shooters[Shooter.scatter];
        const splits = shooters[Shooter.split];
        const ricochets = shooters[Shooter.ricochet];
        const bursts = shooters[Shooter.burst];
        const burstCooldowns = shooters[Shooter.burstCooldown];
        const burstLefts = shooters[Shooter.burstLeft];

        for (let i = 0; i < count; i++) {
            if (burstLefts[i] > 0) {
                burstCooldowns[i] -= time.delta;
                if (burstCooldowns[i] <= 0) {
                    fireBulletGroup(
                        xs[i], ys[i], damages[i], critChances[i], critMults[i],
                        scatters[i], splits[i], ricochets[i], spawn, zombies, random,
                    );
                    burstLefts[i]--;
                    if (burstLefts[i] > 0) burstCooldowns[i] = fireIntervals[i] / 3 / bursts[i];
                }
            }

            if (burstLefts[i] > 0) continue;
            fireTimers[i] -= time.delta;
            if (fireTimers[i] > 0) continue;
            fireTimers[i] = fireIntervals[i];

            fireBulletGroup(
                xs[i], ys[i], damages[i], critChances[i], critMults[i],
                scatters[i], splits[i], ricochets[i], spawn, zombies, random,
            );
            if (bursts[i] > 1) {
                burstLefts[i] = bursts[i] - 1;
                burstCooldowns[i] = fireIntervals[i] / 3 / bursts[i];
            }
        }
    }
}

function fireBulletGroup(
    x: number,
    y: number,
    damage: number,
    critChance: number,
    critMultiplier: number,
    scatterCount: number,
    splitCount: number,
    ricochetCount: number,
    spawn: SpawnService,
    zombies: Zombies,
    random: RandomService,
): void {
    const baseAngle = findNearestZombieAngle(x, y, zombies);
    for (let index = 0; index < scatterCount; index++) {
        let angle = baseAngle;
        if (scatterCount > 1) angle += 0.12 * (index - (scatterCount - 1) * 0.5);
        const variance = random.float(0.9, 1.1);
        const result = (critChance > random.float() ? damage * critMultiplier : damage) * variance;
        spawn.spawnBullet(
            x + 12,
            y + index * 4 - scatterCount * 2,
            angle,
            result,
            splitCount,
            ricochetCount,
        );
    }
}

function findNearestZombieAngle(shooterX: number, shooterY: number, zombies: Zombies): number {
    let closestDistance = Infinity;
    let closestAngle = 0;
    const iter = zombies.iter();
    while (iter.next()) {
        const [count, , positions, , data] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const active = data[Zombie.active];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            const dx = xs[i] - shooterX;
            const dy = ys[i] - shooterY;
            const distance = dx * dx + dy * dy;
            if (distance < closestDistance) {
                closestDistance = distance;
                closestAngle = Math.atan2(dy, dx);
            }
        }
    }
    return closestAngle;
}
