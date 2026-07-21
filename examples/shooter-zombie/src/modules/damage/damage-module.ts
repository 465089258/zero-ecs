import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common";
import { resolveDamageSystem } from "./systems";

/** 伤害计算机制；不认识技能、投射物、僵尸或生命值组件。 */
export class DamageModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(resolveDamageSystem, {
            inSet: GameplaySet.damage,
            after: GameplaySet.collision,
        });
    }
}
