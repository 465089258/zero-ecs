import { CommandService, RandomService, TimeState } from "zero-ecs-lib";
import { Position } from "../common/components";
import { Shooter } from "./components";
import { GameConfig } from "../common/game-config";
import { GameMode, GameState } from "../common/game-state";
import type { Shooters } from "./types";
import { Zombie } from "../zombie/components";
import type { Zombies } from "../zombie/types";
import { spawnBullet } from "../bullet/spawn";
import { BulletConfig } from "../bullet/config";

export function shooterFireSystem(
    gameCfg: Readonly<GameConfig>,
    cfg: Readonly<ShooterConfig>,
    bulletCfg: Readonly<BulletConfig>,
    time: Readonly<TimeState>,
    random: RandomService,
    game: Readonly<GameState>,
    commands: CommandService,
    shooter: Shooters,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = shooter.iter();
    while (iter.next()) {
        const [count, , positions, shooters] = iter.current;
        const xs = positions[Position.x]; const ys = positions[Position.y];
        const fireTimers = shooters[Shooter.fireTimer]; const fireIntervals = shooters[Shooter.fireInterval];
        const damages = shooters[Shooter.damage]; const critChances = shooters[Shooter.critChance];
        const critMults = shooters[Shooter.critMult];
        const scatters = shooters[Shooter.scatter]; const splits = shooters[Shooter.split];
        const ricochets = shooters[Shooter.ricochet]; const bursts = shooters[Shooter.burst];
        const burstCooldowns = shooters[Shooter.burstCooldown]; const burstLefts = shooters[Shooter.burstLeft];

        for (let i = 0; i < count; i++) {
            if (burstLefts[i] > 0) {
                burstCooldowns[i] -= time.delta;
                if (burstCooldowns[i] <= 0) {
                    fireBulletGroup(xs[i], ys[i], damages[i], critChances[i], critMults[i],
                        scatters[i], splits[i], ricochets[i], zombies, random, commands, bulletCfg);
                    burstLefts[i]--;
                    if (burstLefts[i] > 0) burstCooldowns[i] = fireIntervals[i] / 3 / bursts[i];
                }
            }
            if (burstLefts[i] > 0) continue;
            fireTimers[i] -= time.delta;
            if (fireTimers[i] > 0) continue;
            fireTimers[i] = fireIntervals[i];
            fireBulletGroup(xs[i], ys[i], damages[i], critChances[i], critMults[i],
                scatters[i], splits[i], ricochets[i], zombies, random, commands, bulletCfg);
            if (bursts[i] > 1) { burstLefts[i] = bursts[i] - 1; burstCooldowns[i] = fireIntervals[i] / 3 / bursts[i]; }
        }
    }
}

function fireBulletGroup(
    sx: number, sy: number, damage: number, critChance: number, critMult: number,
    scatterCount: number, splitCount: number, ricochetCount: number,
    zombies: Zombies, random: RandomService, commands: CommandService, bulletCfg: BulletConfig,
): void {
    const baseAngle = findNearestZombieAngle(sx, sy, zombies);
    for (let s = 0; s < scatterCount; s++) {
        let angle = baseAngle;
        if (scatterCount > 1) angle += 0.12 * (s - (scatterCount - 1) * 0.5);
        const isCrit = critChance > random.float(0, 1) ? 1 : 0;
        const dmg = (isCrit ? damage * critMult : damage) * random.float(0.9, 1.1);
        spawnBullet(commands, bulletCfg, sx + 12, sy + s * 4 - scatterCount * 2, angle, dmg, splitCount, ricochetCount, 0, isCrit);
    }
}

function findNearestZombieAngle(sx: number, sy: number, zombies: Zombies): number {
    let cd = Infinity, ca = 0;
    const iter = zombies.iter();
    while (iter.next()) {
        const [c, , pp, , zd] = iter.current;
        for (let i = 0; i < c; i++) {
            if (zd[Zombie.active][i] === 0) continue;
            const dx = pp[Position.x][i] - sx, dy = pp[Position.y][i] - sy;
            const d = dx * dx + dy * dy;
            if (d < cd) { cd = d; ca = Math.atan2(dy, dx); }
        }
    }
    return ca;
}
