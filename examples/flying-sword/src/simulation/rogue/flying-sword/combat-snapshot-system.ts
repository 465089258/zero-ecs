import {
    INVALID_ENTITY,
    Update,
    Write,
    defSystem,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordActionQuery,
    FlyingSwordActiveFormation,
    FlyingSwordBehavior,
    FlyingSwordGroupQuery,
    FlyingSwordSkillAction,
    FlyingSwordSkillActionQuery,
    FlyingSwordStance,
    FlyingSwordTaskQuery,
} from "@zero-ecs/flying-sword";
import {
    AutoFlyingSwordSkill,
    EnemyFeedback,
    FireSwordIntent,
    FlyingSwordCombat,
    LightningSwordIntent,
    MetalSwordIntent,
} from "../components";
import {
    RogueAutoFlyingSwordGroupQuery,
    RogueEnemyFeedbackQuery,
    RogueFlyingSwordCombatQuery,
} from "../queries";
import { CombatScratchState } from "../state";
import { DEFAULT_SWORD_DAMAGE } from "./combat-constants";

type AutoGroups = QueryOf<typeof RogueAutoFlyingSwordGroupQuery>;
type SkillActions = QueryOf<typeof FlyingSwordSkillActionQuery>;
type SwordTasks = QueryOf<typeof FlyingSwordTaskQuery>;
type SwordActions = QueryOf<typeof FlyingSwordActionQuery>;
type SwordGroups = QueryOf<typeof FlyingSwordGroupQuery>;
type CombatSwords = QueryOf<typeof RogueFlyingSwordCombatQuery>;
type EnemyFeedbacks = QueryOf<typeof RogueEnemyFeedbackQuery>;

export const snapshotFlyingSwordCombatSystem = defSystem(
    Update.fixed,
    snapshotFlyingSwordCombat,
    [
        Write(CombatScratchState),
        RogueAutoFlyingSwordGroupQuery,
        FlyingSwordSkillActionQuery,
        FlyingSwordTaskQuery,
        FlyingSwordActionQuery,
        FlyingSwordGroupQuery,
        RogueFlyingSwordCombatQuery,
        RogueEnemyFeedbackQuery,
    ],
);

function snapshotFlyingSwordCombat(
    scratch: Mut<CombatScratchState>,
    groups: AutoGroups,
    skillActions: SkillActions,
    tasks: SwordTasks,
    actions: SwordActions,
    swordGroups: SwordGroups,
    swords: CombatSwords,
    enemyFeedbacks: EnemyFeedbacks,
): void {
    buildActionSnapshots(scratch, skillActions, groups);
    buildCombatMembership(scratch, tasks, actions, swordGroups);
    buildTargetFeedback(scratch, swords, enemyFeedbacks);
}

function buildTargetFeedback(
    scratch: Mut<CombatScratchState>,
    swords: CombatSwords,
    enemies: EnemyFeedbacks,
): void {
    const counts = scratch.targetedSwordCounts;
    counts.clear();
    const swordIter = swords.iter();
    while (swordIter.next()) {
        const [count, , , , , , combat] = swordIter.current;
        const targets = combat[FlyingSwordCombat.Target];
        for (let row = 0; row < count; row++) {
            const target = targets[row];
            if (target === INVALID_ENTITY) continue;
            counts.set(target, (counts.get(target) ?? 0) + 1);
        }
    }
    const enemyIter = enemies.iter();
    while (enemyIter.next()) {
        const [count, entities, feedback] = enemyIter.current;
        const targeted =
            feedback[EnemyFeedback.TargetedSwordCount];
        for (let row = 0; row < count; row++) {
            targeted[row] = counts.get(entities[row]) ?? 0;
        }
    }
}

function buildActionSnapshots(
    scratch: Mut<CombatScratchState>,
    actions: SkillActions,
    groups: AutoGroups,
): void {
    let required = 0;
    const countIter = actions.iter();
    while (countIter.next()) required += countIter.current[0];
    scratch.reset(required);
    scratch.groupDamages.clear();
    scratch.groupFocusDamages.clear();
    scratch.groupFormationDamages.clear();
    scratch.groupReattackDelays.clear();
    scratch.groupFormationContactCooldowns.clear();
    scratch.groupLightningChainCounts.clear();
    scratch.groupLightningChainRadii.clear();
    scratch.groupLightningDamageMultipliers.clear();
    scratch.groupMetalMaximumMomentum.clear();
    scratch.groupMetalDamagePerMomentum.clear();
    scratch.groupFireBurstThresholds.clear();
    scratch.groupFireBurstRadii.clear();
    scratch.groupFireBurstDamageMultipliers.clear();
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [count, entities, data, lightning, metal, fire] =
            groupIter.current;
        const damages = data[AutoFlyingSwordSkill.Damage];
        const focusDamageMultipliers =
            data[AutoFlyingSwordSkill.FocusDamageMultiplier];
        const formationDamageMultipliers =
            data[AutoFlyingSwordSkill.FormationDamageMultiplier];
        const reattackDelays =
            data[AutoFlyingSwordSkill.ReattackDelayTicks];
        const formationContactCooldowns =
            data[AutoFlyingSwordSkill.FormationContactCooldownTicks];
        const lightningChainCounts =
            lightning[LightningSwordIntent.ChainCount];
        const lightningChainRadii =
            lightning[LightningSwordIntent.ChainRadius];
        const lightningDamageMultipliers =
            lightning[LightningSwordIntent.DamageMultiplier];
        const metalMaximumMomentum =
            metal[MetalSwordIntent.MaximumMomentum];
        const metalDamagePerMomentum =
            metal[MetalSwordIntent.DamagePerMomentum];
        const fireBurstThresholds =
            fire[FireSwordIntent.BurstThreshold];
        const fireBurstRadii =
            fire[FireSwordIntent.BurstRadius];
        const fireBurstDamageMultipliers =
            fire[FireSwordIntent.BurstDamageMultiplier];
        for (let row = 0; row < count; row++) {
            scratch.groupDamages.set(entities[row], damages[row]);
            scratch.groupFocusDamages.set(
                entities[row],
                damages[row] * focusDamageMultipliers[row],
            );
            scratch.groupFormationDamages.set(
                entities[row],
                damages[row] * formationDamageMultipliers[row],
            );
            scratch.groupReattackDelays.set(
                entities[row],
                reattackDelays[row],
            );
            scratch.groupFormationContactCooldowns.set(
                entities[row],
                formationContactCooldowns[row],
            );
            scratch.groupLightningChainCounts.set(
                entities[row],
                lightningChainCounts[row],
            );
            scratch.groupLightningChainRadii.set(
                entities[row],
                lightningChainRadii[row],
            );
            scratch.groupLightningDamageMultipliers.set(
                entities[row],
                lightningDamageMultipliers[row],
            );
            scratch.groupMetalMaximumMomentum.set(
                entities[row],
                metalMaximumMomentum[row],
            );
            scratch.groupMetalDamagePerMomentum.set(
                entities[row],
                metalDamagePerMomentum[row],
            );
            if (fireBurstThresholds[row] > 0) {
                scratch.groupFireBurstThresholds.set(
                    entities[row],
                    fireBurstThresholds[row],
                );
                scratch.groupFireBurstRadii.set(
                    entities[row],
                    fireBurstRadii[row],
                );
                scratch.groupFireBurstDamageMultipliers.set(
                    entities[row],
                    fireBurstDamageMultipliers[row],
                );
            }
        }
    }
    const iter = actions.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            identities,
        ] = iter.current;
        const groupEntities =
            identities[FlyingSwordSkillAction.Group];
        for (let row = 0; row < count; row++) {
            const index = scratch.actionCount++;
            const group = groupEntities[row];
            scratch.actionEntities[index] = entities[row];
            scratch.actionGroups[index] = group;
            scratch.damages[index] =
                scratch.groupFocusDamages.get(group) ??
                DEFAULT_SWORD_DAMAGE;
        }
    }
}

function buildCombatMembership(
    scratch: Mut<CombatScratchState>,
    tasks: SwordTasks,
    actions: SwordActions,
    groups: SwordGroups,
): void {
    scratch.resetMembership();
    const taskIter = tasks.iter();
    while (taskIter.next()) {
        const [count, entities] = taskIter.current;
        for (let row = 0; row < count; row++) {
            scratch.activeTaskSwords.add(entities[row]);
        }
    }
    const actionIter = actions.iter();
    while (actionIter.next()) {
        const [count, entities] = actionIter.current;
        for (let row = 0; row < count; row++) {
            scratch.activeActionSwords.add(entities[row]);
        }
    }
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [
            count,
            entities,
            ,
            ,
            ,
            ,
            ,
            behaviors,
        ] = groupIter.current;
        const stances = behaviors[FlyingSwordBehavior.Stance];
        const activeFormations =
            behaviors[FlyingSwordBehavior.ActiveFormation];
        for (let row = 0; row < count; row++) {
            if (
                stances[row] === FlyingSwordStance.Formation &&
                activeFormations[row] ===
                    FlyingSwordActiveFormation.None
            ) {
                scratch.formationGroups.add(entities[row]);
            }
        }
    }
}
