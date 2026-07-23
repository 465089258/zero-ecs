import {
    Commands,
    defSystem,
    Update,
    Write,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import { Float2, GameConfigResource, GameMode, GameSessionState } from "../common";
import { ExpOrb } from "./components";
import { ExperienceCollectorQuery, ExpOrbQuery } from "./queries";
import { ProgressionState } from "./state";

type Collectors = QueryOf<typeof ExperienceCollectorQuery>;
type ExpOrbs = QueryOf<typeof ExpOrbQuery>;

export const expCollectSystem = defSystem(Update.fixed, collectExperience, [
    GameConfigResource, TimeState, GameSessionState, Write(ProgressionState),
    Commands, ExpOrbQuery, ExperienceCollectorQuery,
]);

function collectExperience(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    session: Readonly<GameSessionState>,
    progression: Mut<ProgressionState>,
    commands: Commands,
    expOrbs: ExpOrbs,
    collectors: Collectors,
): void {
    if (session.skipTick || session.mode !== GameMode.Playing) return;

    let shooterX = config.shooterX;
    let shooterY = config.shooterY;
    const collectorIter = collectors.iter();
    while (collectorIter.next()) {
        const [count, , positions] = collectorIter.current;
        if (count > 0) {
            const xs = positions[Float2.x];
            const ys = positions[Float2.y];
            shooterX = xs[0];
            shooterY = ys[0];
        }
    }

    const iter = expOrbs.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, data] = iter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        const vxs = velocities[Float2.x];
        const vys = velocities[Float2.y];
        const active = data[ExpOrb.active];
        const values = data[ExpOrb.value];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            const dx = shooterX - xs[i];
            const dy = shooterY - ys[i];
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 18) {
                active[i] = 0;
                commands.entity(entities[i]).despawn().submit();
                progression.xp += values[i];
                continue;
            }
            const speed = 420 + distance * 0.3;
            vxs[i] = dx / distance * speed;
            vys[i] = dy / distance * speed;
            xs[i] += vxs[i] * time.delta;
            ys[i] += vys[i] * time.delta;
        }
    }
}
