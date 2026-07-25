import type {
    GameBuilder,
    Module,
} from "@zero-ecs/game";
import { DamageDisplayAccessState } from "./state";
import {
    DamageDisplaySystemOptions,
    captureDamageDisplaysSystem,
    expireDamageDisplaysSystem,
} from "./systems";

/** 战斗伤害请求到世界空间飘字的独立示例模块。 */
export class FlyingSwordDamageDisplayModule implements Module {
    build(builder: GameBuilder): void {
        builder.addState(DamageDisplayAccessState);
        builder.addSystem(
            captureDamageDisplaysSystem,
            DamageDisplaySystemOptions.capture,
        );
        builder.addSystem(
            expireDamageDisplaysSystem,
            DamageDisplaySystemOptions.expire,
        );
    }
}
