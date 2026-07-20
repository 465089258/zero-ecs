import { Commands, defSystem, TimeState, Update, type Entity, type QueryOf } from "@zero-ecs/game";
import { Position } from "../common/components";
import { GameMode, GameState } from "../common/game-state";
import { Shooter, ShotRequest, ShotRequestType } from "./components";
import { ShooterQuery } from "./queries";

type Shooters = QueryOf<typeof ShooterQuery>;

export const shooterFireSystem = defSystem(Update.fixed, fireShooter, [
    TimeState, GameState, Commands, ShooterQuery,
]);

function fireShooter(
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: Commands,
    shooter: Shooters,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = shooter.iter();
    while (iter.next()) {
        const [count, entities, positions, shooters] = iter.current;
        const fireTimers = shooters[Shooter.fireTimer];
        const fireIntervals = shooters[Shooter.fireInterval];
        const bursts = shooters[Shooter.burst];
        const burstCooldowns = shooters[Shooter.burstCooldown];
        const burstLefts = shooters[Shooter.burstLeft];

        for (let i = 0; i < count; i++) {
            if (burstLefts[i] > 0) {
                burstCooldowns[i] -= time.delta;
                if (burstCooldowns[i] <= 0) {
                    submitShot(
                        commands,
                        entities[i] as Entity,
                        positions[Position.x][i],
                        positions[Position.y][i],
                        shooters[Shooter.damage][i],
                        shooters[Shooter.critChance][i],
                        shooters[Shooter.critMult][i],
                        shooters[Shooter.scatter][i],
                        shooters[Shooter.split][i],
                        shooters[Shooter.ricochet][i],
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
                entities[i] as Entity,
                positions[Position.x][i],
                positions[Position.y][i],
                shooters[Shooter.damage][i],
                shooters[Shooter.critChance][i],
                shooters[Shooter.critMult][i],
                shooters[Shooter.scatter][i],
                shooters[Shooter.split][i],
                shooters[Shooter.ricochet][i],
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
    commands.spawn()
        .add(ShotRequestType)
        .set(ShotRequestType, ShotRequest.source, source)
        .set(ShotRequestType, ShotRequest.x, x)
        .set(ShotRequestType, ShotRequest.y, y)
        .set(ShotRequestType, ShotRequest.damage, damage)
        .set(ShotRequestType, ShotRequest.critChance, critChance)
        .set(ShotRequestType, ShotRequest.critMultiplier, critMultiplier)
        .set(ShotRequestType, ShotRequest.scatter, scatter)
        .set(ShotRequestType, ShotRequest.split, split)
        .set(ShotRequestType, ShotRequest.ricochet, ricochet).submit();
}
