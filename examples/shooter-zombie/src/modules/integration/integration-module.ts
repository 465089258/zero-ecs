import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common/gameplay-schedule";
import { applyAttributeChangesSystem } from "../attribute/systems";
import { GameContentService } from "./game-content-service";
import { waveSpawnSystem } from "./wave-system";
import {
    damageFeedbackSystem,
    damageResultCleanupSystem,
    damageToAttributeSystem,
    healthReactionSystem,
    projectileDamageSystem,
    rebuildShooterSystem,
    shotToProjectileSystem,
    zombieWallDamageSystem,
} from "./systems";

/** 集中注册所有跨功能模块的游戏规则。 */
export class GameplayIntegrationModule implements Module {
    build(builder: GameBuilder): void {
        builder.addService(GameContentService);

        builder.addSystem(waveSpawnSystem, {
            inSet: GameplaySet.spawn,
            after: GameplaySet.lifecycle,
        });

        builder.addSystem(shotToProjectileSystem, {
            inSet: GameplaySet.collision,
            after: GameplaySet.projectile,
        });
        builder.addSystem(projectileDamageSystem, {
            inSet: GameplaySet.collision,
            after: GameplaySet.projectile,
        });
        builder.addSystem(zombieWallDamageSystem, {
            inSet: GameplaySet.collision,
            after: GameplaySet.projectile,
        });
        builder.addSystem(damageToAttributeSystem, {
            inSet: GameplaySet.attribute,
            after: GameplaySet.damage,
            before: applyAttributeChangesSystem,
        });
        builder.addSystem(damageFeedbackSystem, {
            inSet: GameplaySet.reaction,
            after: GameplaySet.damage,
        });
        builder.addSystem(healthReactionSystem, {
            inSet: GameplaySet.reaction,
            after: GameplaySet.attribute,
        });
        builder.addSystem(damageResultCleanupSystem, {
            inSet: GameplaySet.reaction,
            after: [damageFeedbackSystem, damageToAttributeSystem],
        });
        builder.addSystem(rebuildShooterSystem, {
            inSet: GameplaySet.statistics,
            after: GameplaySet.progression,
        });
    }
}
