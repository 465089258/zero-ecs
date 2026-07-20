import { defSystem, TimeState, Update, type QueryOf } from "@zero-ecs/game";
import { Position, Velocity } from "../common/components";
import { GameMode, GameState } from "../common/game-state";
import { GameConfigResource } from "../common/resources";
import { Zombie } from "./components";
import { ZombieQuery } from "./queries";

type Zombies = QueryOf<typeof ZombieQuery>;

/** Zombie Core 只消费移动所需数据，不关心波次或实体从哪里创建。 */
export const moveZombiesSystem = defSystem(Update.fixed, moveZombies, [
    GameConfigResource, TimeState, GameState, ZombieQuery,
]);

function moveZombies(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = zombies.iter();
    while (iter.next()) {
        const [count, , positions, velocities, data] = iter.current;
        const xs = positions[Position.x];
        const vxs = velocities[Velocity.x];
        const active = data[Zombie.active];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            xs[i] += vxs[i] * time.delta;
            if (xs[i] <= config.wallX + config.wallHalfWidth + config.zombieRadius) {
                xs[i] = config.wallX + config.wallHalfWidth + config.zombieRadius;
                vxs[i] = 0;
            }
        }
    }
}
