import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common";
import { moveZombiesSystem } from "./systems";

export class ZombieModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(moveZombiesSystem, {
            inSet: GameplaySet.projectile,
            after: GameplaySet.intent,
        });
    }
}
