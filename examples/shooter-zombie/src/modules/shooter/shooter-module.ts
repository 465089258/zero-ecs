import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common";
import { shooterFireSystem } from "./systems";

export class ShooterModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(shooterFireSystem, {
            inSet: GameplaySet.intent,
            after: GameplaySet.spawn,
        });
    }
}
