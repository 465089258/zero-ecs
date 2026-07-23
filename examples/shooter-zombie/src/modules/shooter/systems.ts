import { Commands, defSystem, Update, type Entity, type QueryOf } from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import { Float2, GameMode, GameSessionState } from "../common";
import { Shooter, ShotRequest, ShotRequestType } from "./components";
import { ShooterQuery } from "./queries";

type Shooters = QueryOf<typeof ShooterQuery>;

export const shooterFireSystem = defSystem(Update.fixed, fireShooter, [
    TimeState, GameSessionState, Commands, ShooterQuery,
]);

function fireShooter(
    time: Readonly<TimeState>,
    session: Readonly<GameSessionState>,
    commands: Commands,
    shooter: Shooters,
): void {
    if (session.skipTick || session.mode !== GameMode.Playing) return;
    const iter = shooter.iter();
    while (iter.next()) {
        const [count, entities, positions, shooters] = iter.current;
        const fireTimers = shooters[Shooter.fireTimer];
        const fireIntervals = shooters[Shooter.fireInterval];
        const damages = shooters[Shooter.damage];
        const critChances = shooters[Shooter.critChance];
        const critMultipliers = shooters[Shooter.critMult];
        const scatters = shooters[Shooter.scatter];
        const splits = shooters[Shooter.split];
        const ricochets = shooters[Shooter.ricochet];
        const bursts = shooters[Shooter.burst];
        const burstCooldowns = shooters[Shooter.burstCooldown];
        const burstLefts = shooters[Shooter.burstLeft];
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];

        for (let i = 0; i < count; i++) {
            if (burstLefts[i] > 0) {
                burstCooldowns[i] -= time.delta;
                if (burstCooldowns[i] <= 0) {
                    submitShot(
                        commands,
                        entities[i],
                        xs[i],
                        ys[i],
                        damages[i],
                        critChances[i],
                        critMultipliers[i],
                        scatters[i],
                        splits[i],
                        ricochets[i],
                    );
                    burstLefts[i]--;
                    if (burstLefts[i] > 0) burstCooldowns[i] = fireIntervals[i] / 3 / bursts[i];
                }
            }

            if (burstLefts[i] > 0) continue;
            fireTimers[i] -= time.delta;
            if (fireTimers[i] > 0) continue;
            fireTimers[i] = fireIntervals[i];
            submitShot(
                commands,
                entities[i],
                xs[i],
                ys[i],
                damages[i],
                critChances[i],
                critMultipliers[i],
                scatters[i],
                splits[i],
                ricochets[i],
            );
            if (bursts[i] > 1) {
                burstLefts[i] = bursts[i] - 1;
                burstCooldowns[i] = fireIntervals[i] / 3 / bursts[i];
            }
        }
    }
}

function submitShot(
    commands: Commands,
    source: Entity,
    x: number,
    y: number,
    damage: number,
    critChance: number,
    critMultiplier: number,
    scatter: number,
    split: number,
    ricochet: number,
): void {
    commands
        .spawn()
        .add(ShotRequestType)
        .set(ShotRequestType, ShotRequest.source, source)
        .set(ShotRequestType, ShotRequest.x, x)
        .set(ShotRequestType, ShotRequest.y, y)
        .set(ShotRequestType, ShotRequest.damage, damage)
        .set(ShotRequestType, ShotRequest.critChance, critChance)
        .set(ShotRequestType, ShotRequest.critMultiplier, critMultiplier)
        .set(ShotRequestType, ShotRequest.scatter, scatter)
        .set(ShotRequestType, ShotRequest.split, split)
        .set(ShotRequestType, ShotRequest.ricochet, ricochet)
        .submit();
}
