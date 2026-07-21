import { type GameBuilder, type Module } from "@zero-ecs/game";
import { GameplaySet } from "../common";
import { GameContentService } from "./game-content-service";
import { restartSystem, startupGameSystem, statisticsSystem } from "./lifecycle-systems";
import { progressionInputSystem } from "./progression-input-system";
import { GameplayStatisticsState, WaveState } from "./state";
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
        builder
            .addState(WaveState)
            .addState(GameplayStatisticsState)
            .addService(GameContentService)
            .addSystem(startupGameSystem);

        builder.addSystem(restartSystem, { inSet: GameplaySet.lifecycle });

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
            inSet: GameplaySet.attributeRequest,
            after: GameplaySet.damage,
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

        builder.addSystem(progressionInputSystem, {
            inSet: GameplaySet.progressionInput,
            after: GameplaySet.progression,
        });

        builder.addSystem(rebuildShooterSystem, {
            inSet: GameplaySet.statistics,
            after: GameplaySet.progressionInput,
        });

        builder.addSystem(statisticsSystem, {
            inSet: GameplaySet.statistics,
            after: GameplaySet.progressionInput,
        });
    }
}
