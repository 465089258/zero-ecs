import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common";
import { ProgressionState } from "./state";
import { expCollectSystem } from "./systems";

export class ProgressionModule implements Module {
    build(builder: GameBuilder): void {
        builder.addState(ProgressionState);
        builder.addSystem(expCollectSystem, {
            inSet: GameplaySet.progression,
            after: GameplaySet.reaction,
        });
    }
}
