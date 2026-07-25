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
    FlyingSwordSkillProgress,
    FlyingSwordSkillTiming,
    FlyingSwordStance,
    FlyingSwordTaskQuery,
} from "@zero-ecs/flying-sword";
import {
    AutoFlyingSwordSkill,
    EnemyFeedback,
    FlyingSwordCombat,
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
    scratch.groupReattackDelays.clear();
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [count, entities, data] = groupIter.current;
        const damages = data[AutoFlyingSwordSkill.Damage];
        const reattackDelays =
            data[AutoFlyingSwordSkill.ReattackDelayTicks];
        for (let row = 0; row < count; row++) {
            scratch.groupDamages.set(entities[row], damages[row]);
            scratch.groupReattackDelays.set(
                entities[row],
                reattackDelays[row],
            );
        }
    }
    const iter = actions.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            identities,
            ,
            timings,
            progresses,
        ] = iter.current;
        const groupEntities =
            identities[FlyingSwordSkillAction.Group];
        const startTicks = timings[FlyingSwordSkillTiming.StartTick];
        const reserved =
            progresses[FlyingSwordSkillProgress.ReservedCount];
        for (let row = 0; row < count; row++) {
            const index = scratch.actionCount++;
            const group = groupEntities[row];
            scratch.actionEntities[index] = entities[row];
            scratch.actionGroups[index] = group;
            scratch.startTicks[index] = startTicks[row];
            scratch.reservedCounts[index] = reserved[row];
            scratch.damages[index] =
                scratch.groupDamages.get(group) ??
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
