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
    FireSwordIntentAccessState,
    FocusSwordContactAccessState,
    FocusPiercingCandidateState,
    FlyingSwordTargetingState,
    FusionPiercingCandidateState,
    LightningChainAccessState,
    RogueEntityAccessState,
} from "./state";
import {
    RogueSystemOptions,
    advanceRogueRunClockSystem,
    applyRogueUpgradeRequestsSystem,
    collectRogueExperienceSystem,
    collideEnemiesWithPlayerSystem,
    directEnemySpawnsSystem,
    openRogueUpgradeSelectionSystem,
    reactToRogueDeathsSystem,
    resolveRogueDamageSystem,
    updateEnemyIntentSystem,
} from "./systems";
import {
    rebuildEnemySpatialIndexSystem,
} from "./flying-sword/combat-spatial-index";
import {
    snapshotFlyingSwordCombatSystem,
} from "./flying-sword/combat-snapshot-system";
import {
    collideFocusSwordContactsSystem,
} from "./flying-sword/focus-contact-system";
import {
    collideFormationSwordContactsSystem,
} from "./flying-sword/formation-contact-system";
import {
    driveScatterFlyingSwordsSystem,
} from "./flying-sword/scatter-system";
import {
    collideScatterSwordContactsSystem,
} from "./flying-sword/scatter-contact-system";
import {
    collideSwordBodyUnitySystem,
} from "./flying-sword/sword-body-unity-system";
import {
    chainLightningDamageSystem,
    expireLightningArcsSystem,
} from "./flying-sword/lightning-chain-system";
import {
    applyMetalBreakSystem,
} from "./flying-sword/metal-break-system";
import {
    applyFireSwordIntentSystem,
    expireFireBurstsSystem,
} from "./flying-sword/fire-burst-system";

export class FlyingSwordRogueSimulationModule implements Module {
    build(builder: GameBuilder): void {
        builder
            .addResource(EnemyCatalog, new EnemyCatalog())
            .addResource(RogueRunTuning, new RogueRunTuning())
            .addResource(RogueUpgradeCatalog, new RogueUpgradeCatalog())
            .addState(EnemySpatialIndexState)
            .addState(CombatScratchState)
            .addState(FocusSwordContactAccessState)
            .addState(FocusPiercingCandidateState)
            .addState(FusionPiercingCandidateState)
            .addState(FireSwordIntentAccessState)
            .addState(LightningChainAccessState)
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
            snapshotFlyingSwordCombatSystem,
            RogueSystemOptions.combatSnapshot,
        );
        builder.addSystem(
            collideFocusSwordContactsSystem,
            RogueSystemOptions.swordContact,
        );
        builder.addSystem(
            collideScatterSwordContactsSystem,
            RogueSystemOptions.swordContact,
        );
        builder.addSystem(
            collideFormationSwordContactsSystem,
            RogueSystemOptions.swordContact,
        );
        builder.addSystem(
            collideSwordBodyUnitySystem,
            RogueSystemOptions.swordContact,
        );
        builder.addSystem(
            chainLightningDamageSystem,
            RogueSystemOptions.damageEffects,
        );
        builder.addSystem(
            applyMetalBreakSystem,
            RogueSystemOptions.damageEffects,
        );
        builder.addSystem(
            applyFireSwordIntentSystem,
            RogueSystemOptions.damageEffects,
        );
        builder.addSystem(
            expireLightningArcsSystem,
            RogueSystemOptions.damageEffects,
        );
        builder.addSystem(
            expireFireBurstsSystem,
            RogueSystemOptions.damageEffects,
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
