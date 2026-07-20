import {
    Commands,
    defSystem,
    TimeState,
    Update,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import { Position, Velocity } from "../common/components";
import { GameMode, GameState } from "../common/game-state";
import { GameConfigResource } from "../common/resources";
import { Bullet } from "./components";
import { BulletQuery } from "./queries";

type Bullets = QueryOf<typeof BulletQuery>;

export const moveBulletsSystem = defSystem(Update.fixed, moveBullets, [
    GameConfigResource, TimeState, GameState, Commands, BulletQuery,
]);

function moveBullets(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: Commands,
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
