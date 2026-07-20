import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common/gameplay-schedule";
import { restartSystem, startupGameSystem, statisticsSystem } from "./systems";

export class LifecycleModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(startupGameSystem);

        builder.addSystem(restartSystem, { inSet: GameplaySet.lifecycle });

        builder.addSystem(statisticsSystem, {
            inSet: GameplaySet.statistics,
            after: GameplaySet.progression,
        });
    }
}
