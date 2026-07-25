import type {
    GameBuilder,
    Module,
} from "@zero-ecs/game";
import { RogueRunControlService } from "../../app/run-control-service";
import { EnemyCatalog } from "../../content/enemies";
import { RogueRunTuning } from "../../content/run-tuning";
import { RogueUpgradeCatalog } from "../../content/upgrades";
import { RogueContentService } from "./content-service";
import {
    CombatScratchState,
    EnemySpatialIndexState,
    FlyingSwordTargetingState,
    RogueEntityAccessState,
} from "./state";
import {
    RogueSystemOptions,
    advanceRogueRunClockSystem,
    applyRogueUpgradeRequestsSystem,
    driveScatterFlyingSwordsSystem,
    collectRogueExperienceSystem,
    collideEnemiesWithPlayerSystem,
    collideFlyingSwordsWithEnemiesSystem,
    directEnemySpawnsSystem,
    openRogueUpgradeSelectionSystem,
    reactToRogueDeathsSystem,
    rebuildEnemySpatialIndexSystem,
    resolveRogueDamageSystem,
    updateEnemyIntentSystem,
} from "./systems";

export class FlyingSwordRogueSimulationModule implements Module {
    build(builder: GameBuilder): void {
        builder
            .addResource(EnemyCatalog, new EnemyCatalog())
            .addResource(RogueRunTuning, new RogueRunTuning())
            .addResource(RogueUpgradeCatalog, new RogueUpgradeCatalog())
            .addState(EnemySpatialIndexState)
            .addState(CombatScratchState)
            .addState(FlyingSwordTargetingState)
            .addState(RogueEntityAccessState)
            .addService(RogueContentService)
            .addService(RogueRunControlService);
        builder.addSystem(
            applyRogueUpgradeRequestsSystem,
            RogueSystemOptions.applyUpgrade,
        );
        builder.addSystem(
            advanceRogueRunClockSystem,
            RogueSystemOptions.clock,
        );
        builder.addSystem(
            directEnemySpawnsSystem,
            RogueSystemOptions.spawn,
        );
        builder.addSystem(
            updateEnemyIntentSystem,
            RogueSystemOptions.intent,
        );
        builder.addSystem(
            driveScatterFlyingSwordsSystem,
            RogueSystemOptions.targeting,
        );
        builder.addSystem(
            rebuildEnemySpatialIndexSystem,
            RogueSystemOptions.spatial,
        );
        builder.addSystem(
            collideFlyingSwordsWithEnemiesSystem,
            RogueSystemOptions.swordContact,
        );
        builder.addSystem(
            collideEnemiesWithPlayerSystem,
            RogueSystemOptions.playerContact,
        );
        builder.addSystem(
            resolveRogueDamageSystem,
            RogueSystemOptions.damage,
        );
        builder.addSystem(
            reactToRogueDeathsSystem,
            RogueSystemOptions.death,
        );
        builder.addSystem(
            collectRogueExperienceSystem,
            RogueSystemOptions.progression,
        );
        builder.addSystem(
            openRogueUpgradeSelectionSystem,
            RogueSystemOptions.openUpgrade,
        );
    }
}
