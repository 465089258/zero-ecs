import { CommandService, type Entity, type Mut } from "zero-ecs-lib";
import { ExpOrb } from "./components";
import { Position, Velocity } from "../common/components";
import { GameMode, GameState } from "../common/game-state";
import type { ExpOrbs } from "./types";
import type { Shooters } from "../shooter/types";

export function expCollectSystem(
    game: Mut<GameState>,
    commands: CommandService,
    expOrbs: ExpOrbs,
    shooter: Shooters,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    let shooterX = 70, shooterY = 320;
    const sIter = shooter.iter();
    while (sIter.next()) {
        const [sCount, , sPositions] = sIter.current;
        if (sCount > 0) { shooterX = sPositions[Position.x][0]; shooterY = sPositions[Position.y][0]; }
    }

    const magnetSpeed = 420; const collectRange = 18;
    const iter = expOrbs.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, orbData] = iter.current;
        const xs = positions[Position.x]; const ys = positions[Position.y];
        const vxs = velocities[Velocity.x]; const vys = velocities[Velocity.y];
        const active = orbData[ExpOrb.active]; const values = orbData[ExpOrb.value];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            const dx = shooterX - xs[i], dy = shooterY - ys[i];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < collectRange) { active[i] = 0; commands.entity(entities[i] as Entity).despawn().submit(); game.xp += values[i]; continue; }
            const speed = magnetSpeed + dist * 0.3;
            vxs[i] = (dx / dist) * speed; vys[i] = (dy / dist) * speed;
            xs[i] += vxs[i] * (1 / 120); ys[i] += vys[i] * (1 / 120);
        }
    }
}
