import type { GameBuilder, Module } from "@zero-ecs/game";
import { GameplaySet } from "../common";
import { damageTextUpdateSystem } from "./systems";

/** 独立的短时视觉反馈模块，不依赖 Damage 或 Progression 的实现。 */
export class FeedbackModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(damageTextUpdateSystem, {
            inSet: GameplaySet.feedback,
            after: GameplaySet.reaction,
        });
    }
}
