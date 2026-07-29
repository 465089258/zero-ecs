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
} from "../../../domain/flying-sword";
import {
    AutoFlyingSwordSkill,
    ColdSwordIntent,
    EnemyFeedback,
    FireSwordIntent,
    FlyingSwordCombat,
    FocusCastPower,
    LightningSwordIntent,
    MetalSwordIntent,
} from "../components";
import {
    RogueAutoFlyingSwordGroupQuery,
    RogueEnemyFeedbackQuery,
    RogueFlyingSwordCombatQuery,
    RoguePoweredFocusActionQuery,
} from "../queries";
import { CombatScratchState } from "../state";

type AutoGroups = QueryOf<typeof RogueAutoFlyingSwordGroupQuery>;
type SkillActions = QueryOf<typeof FlyingSwordSkillActionQuery>;
type PoweredFocusActions =
    QueryOf<typeof RoguePoweredFocusActionQuery>;
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
        RoguePoweredFocusActionQuery,
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
    poweredFocusActions: PoweredFocusActions,
    tasks: SwordTasks,
    actions: SwordActions,
    swordGroups: SwordGroups,
    swords: CombatSwords,
    enemyFeedbacks: EnemyFeedbacks,
): void {
    buildActionSnapshots(
        scratch,
        skillActions,
        poweredFocusActions,
        groups,
    );
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
    poweredActions: PoweredFocusActions,
    groups: AutoGroups,
): void {
    let required = 0;
    const countIter = actions.iter();
    while (countIter.next()) required += countIter.current[0];
    scratch.reset(required);
    scratch.groupFocusDamageMultipliers.clear();
    scratch.groupFormationDamageMultipliers.clear();
    scratch.groupFormationContactCooldowns.clear();
    scratch.groupLightningChainCounts.clear();
    scratch.groupLightningChainRadii.clear();
    scratch.groupLightningDamageMultipliers.clear();
    scratch.groupMetalMaximumMomentum.clear();
    scratch.groupMetalDamagePerMomentum.clear();
    scratch.groupFireBurstThresholds.clear();
    scratch.groupFireBurstRadii.clear();
    scratch.groupFireBurstDamageMultipliers.clear();
    scratch.groupColdMaximumStacks.clear();
    scratch.groupColdSlowPerStack.clear();
    scratch.groupColdDurationTicks.clear();
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [
            count,
            entities,
            data,
            lightning,
            metal,
            fire,
            cold,
        ] = groupIter.current;
        const focusDamageMultipliers =
            data[AutoFlyingSwordSkill.FocusDamageMultiplier];
        const formationDamageMultipliers =
            data[AutoFlyingSwordSkill.FormationDamageMultiplier];
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
        const coldMaximumStacks =
            cold[ColdSwordIntent.MaximumStacks];
        const coldSlowPerStack =
            cold[ColdSwordIntent.SlowPerStack];
        const coldDurationTicks =
            cold[ColdSwordIntent.DurationTicks];
        for (let row = 0; row < count; row++) {
            scratch.groupFocusDamageMultipliers.set(
                entities[row],
                focusDamageMultipliers[row],
            );
            scratch.groupFormationDamageMultipliers.set(
                entities[row],
                formationDamageMultipliers[row],
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
            if (coldMaximumStacks[row] > 0) {
                scratch.groupColdMaximumStacks.set(
                    entities[row],
                    coldMaximumStacks[row],
                );
                scratch.groupColdSlowPerStack.set(
                    entities[row],
                    coldSlowPerStack[row],
                );
                scratch.groupColdDurationTicks.set(
                    entities[row],
                    coldDurationTicks[row],
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
            scratch.actionFocusDamageMultipliers[index] = 1;
        }
    }
    const poweredIter = poweredActions.iter();
    while (poweredIter.next()) {
        const [count, entities, , powers] = poweredIter.current;
        const multipliers =
            powers[FocusCastPower.DamageMultiplier];
        for (let row = 0; row < count; row++) {
            const entity = entities[row];
            for (let index = 0; index < scratch.actionCount; index++) {
                if (scratch.actionEntities[index] !== entity) continue;
                scratch.actionFocusDamageMultipliers[index] =
                    multipliers[row];
                break;
            }
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
