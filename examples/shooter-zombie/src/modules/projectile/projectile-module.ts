import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common";
import { moveBulletsSystem } from "./systems";

export class ProjectileModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(moveBulletsSystem, {
            inSet: GameplaySet.projectile,
            after: GameplaySet.intent,
        });
    }
}
