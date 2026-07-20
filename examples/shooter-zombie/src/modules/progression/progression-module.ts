import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common/gameplay-schedule";
import { damageTextUpdateSystem, expCollectSystem, levelUpSystem } from "./systems";

export class ProgressionModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(expCollectSystem, {
            inSet: GameplaySet.progression,
            after: GameplaySet.reaction,
        });
        builder.addSystem(damageTextUpdateSystem, {
            inSet: GameplaySet.progression,
            after: expCollectSystem,
        });
        builder.addSystem(levelUpSystem, {
            inSet: GameplaySet.progression,
            after: damageTextUpdateSystem,
        });
    }
}
