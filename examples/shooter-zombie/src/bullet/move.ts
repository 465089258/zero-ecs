import { CommandService, TimeState, type Entity } from "zero-ecs-lib";
import { Bullet } from "./components";
import { Position, Velocity } from "../common/components";
import { GameConfig } from "../common/game-config";
import { GameMode, GameState } from "../common/game-state";
import type { Bullets } from "./types";

export function moveBulletsSystem(
    config: Readonly<GameConfig>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: CommandService,
    bullets: Bullets,
): void {
    if (game.skipTick || game.mode === GameMode.GameOver || game.mode === GameMode.LevelUp) return;
    const wallInset = 10;
    const iter = bullets.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, bulletData] = iter.current;
        const xs = positions[Position.x]; const ys = positions[Position.y];
        const vxs = velocities[Velocity.x]; const vys = velocities[Velocity.y];
        const ricochetCounts = bulletData[Bullet.ricochetCount];
        const lifetimes = bulletData[Bullet.lifetime];
        const active = bulletData[Bullet.active];
        const radii = bulletData[Bullet.radius];
        const ignoreEntities = bulletData[Bullet.ignoreEntity];

        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            let x = xs[i] + vxs[i] * time.delta;
            let y = ys[i] + vys[i] * time.delta;
            lifetimes[i] -= time.delta;
            let bounced = false;
            const r = radii[i];
            if (x - r < wallInset) { x = wallInset + r; vxs[i] = Math.abs(vxs[i]); bounced = true; }
            else if (x + r > config.width - wallInset) { x = config.width - wallInset - r; vxs[i] = -Math.abs(vxs[i]); bounced = true; }
            if (y - r < wallInset) { y = wallInset + r; vys[i] = Math.abs(vys[i]); bounced = true; }
            else if (y + r > config.height - wallInset) { y = config.height - wallInset - r; vys[i] = -Math.abs(vys[i]); bounced = true; }
            if (bounced) {
                if (ricochetCounts[i] > 0) {
                    ricochetCounts[i]--;
                    lifetimes[i] += 0.5;
                    ignoreEntities[i] = 0;
                } else {
                    active[i] = 0;
                    commands.entity(entities[i] as Entity).despawn().submit();
                    continue;
                }
            }
            xs[i] = x; ys[i] = y;
            if (lifetimes[i] <= 0) {
                active[i] = 0;
                commands.entity(entities[i] as Entity).despawn().submit();
            }
        }
    }
}
