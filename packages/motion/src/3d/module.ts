import type {
    GameBuilder,
    Module,
} from "@zero-ecs/game";
import {
    MoveTowards3SystemOptions,
    moveTowards3System,
} from "./systems";

export class Motion3Module implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(
            moveTowards3System,
            MoveTowards3SystemOptions,
        );
    }
}
