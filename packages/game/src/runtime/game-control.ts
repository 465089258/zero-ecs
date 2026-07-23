import type { Scheduler } from "@zero-ecs/scheduler";
import type { Game } from "./game";
import type { SystemParam } from "./system";

/** @internal 仅供 Game 包内实例局部工具取得所属 Scheduler。 */
export const GAME_SCHEDULER: unique symbol = Symbol("Game.scheduler");

/** @internal Game 的包内运行控制协议。 */
export interface GameControl {
    [GAME_SCHEDULER](): Scheduler<SystemParam>;
}

/** 在包内把 Game 收窄为实例控制协议。 @internal */
export function gameControl(game: Game): GameControl {
    return game as Game & GameControl;
}
