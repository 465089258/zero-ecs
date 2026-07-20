import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common/gameplay-schedule";
import { applyAttributeChangesSystem } from "./systems";

/** 通用属性机制；不认识 Shooter、Zombie、Projectile 或 Damage。 */
export class AttributeModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(applyAttributeChangesSystem, {
            inSet: GameplaySet.attribute,
            after: GameplaySet.damage,
        });
    }
}
