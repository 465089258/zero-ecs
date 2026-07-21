import { defSystem, TimeState, Update, type QueryOf } from "@zero-ecs/game";
import { Float2, GameConfigResource, GameMode, GameSessionState } from "../common";
import { Zombie } from "./components";
import { ZombieQuery } from "./queries";

type Zombies = QueryOf<typeof ZombieQuery>;

/** Zombie Core 只消费移动所需数据，不关心波次或实体从哪里创建。 */
export const moveZombiesSystem = defSystem(Update.fixed, moveZombies, [
    GameConfigResource, TimeState, GameSessionState, ZombieQuery,
]);

function moveZombies(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    session: Readonly<GameSessionState>,
    zombies: Zombies,
): void {
    if (session.skipTick || session.mode !== GameMode.Playing) return;
    const iter = zombies.iter();
    while (iter.next()) {
        const [count, , positions, velocities, data] = iter.current;
        const xs = positions[Float2.x];
        const vxs = velocities[Float2.x];
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
