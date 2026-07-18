import { TimeState } from "zero-ecs-lib";
import { Position, Velocity } from "../common/components";
import { Zombie } from "./components";
import { GameConfig } from "../common/game-config";
import { GameMode, GameState } from "../common/game-state";
import type { Zombies } from "./types";

export function moveZombiesSystem(
    config: Readonly<GameConfig>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = zombies.iter();
    const wallBoundary = config.wallBoundary;

    while (iter.next()) {
        const [count, , positions, velocities, zombieData] = iter.current;
        const xs = positions[Position.x]; const vxs = velocities[Velocity.x];
        const active = zombieData[Zombie.active];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            xs[i] += vxs[i] * time.delta;
            if (xs[i] <= wallBoundary) { xs[i] = wallBoundary; vxs[i] = 0; }
        }
    }
}
