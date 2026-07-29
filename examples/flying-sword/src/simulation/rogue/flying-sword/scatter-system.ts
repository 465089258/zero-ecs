import {
    Update,
    Write,
    defSystem,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordActiveFormation,
    FlyingSwordBehavior,
    FlyingSwordGroupQuery,
    FlyingSwordMember,
    FlyingSwordService,
    FlyingSwordSkillPhase,
    FlyingSwordSkillService,
    FlyingSwordStance,
    FlyingSwordTaskQuery,
} from "../../../domain/flying-sword";
import { Float3 } from "../../../infrastructure/math";
import {
    AutoFlyingSwordSkill,
    EnemyBody,
    EnemyIdentity,
    FlyingSwordCombat,
    Health,
    RogueRunClock,
    RogueRunIdentity,
    RogueRunPhase,
    RogueRunStatus,
    RogueRunTarget,
    SwordSpiritPower,
} from "../components";
import {
    RogueAutoFlyingSwordGroupQuery,
    RogueEnemyQuery,
    RogueFlyingSwordCombatQuery,
    RoguePlayerQuery,
    RogueRunQuery,
} from "../queries";
import {
    CombatScratchState,
    FlyingSwordTargetingState,
} from "../state";

type Runs = QueryOf<typeof RogueRunQuery>;
type Players = QueryOf<typeof RoguePlayerQuery>;
type Enemies = QueryOf<typeof RogueEnemyQuery>;
type AutoGroups = QueryOf<typeof RogueAutoFlyingSwordGroupQuery>;
type CombatSwords = QueryOf<typeof RogueFlyingSwordCombatQuery>;
type SwordTasks = QueryOf<typeof FlyingSwordTaskQuery>;
type SwordGroups = QueryOf<typeof FlyingSwordGroupQuery>;

export const driveScatterFlyingSwordsSystem = defSystem(
    Update.fixed,
    driveScatterFlyingSwords,
    [
        FlyingSwordService,
        FlyingSwordSkillService,
        Write(CombatScratchState),
        Write(FlyingSwordTargetingState),
        RogueRunQuery,
        RoguePlayerQuery,
        RogueEnemyQuery,
        RogueAutoFlyingSwordGroupQuery,
        RogueFlyingSwordCombatQuery,
        FlyingSwordTaskQuery,
        FlyingSwordGroupQuery,
    ],
);

function driveScatterFlyingSwords(
    flyingSwords: FlyingSwordService,
    skills: FlyingSwordSkillService,
    scratch: Mut<CombatScratchState>,
    targeting: Mut<FlyingSwordTargetingState>,
    runs: Runs,
    players: Players,
    enemies: Enemies,
    groups: AutoGroups,
    swords: CombatSwords,
    tasks: SwordTasks,
    swordGroups: SwordGroups,
): void {
    let tick = 0;
    let phase = RogueRunPhase.Defeat;
    let swordGroup = 0 as Entity;
    let skillTargetXs: Float32Array | undefined;
    let skillTargetYs: Float32Array | undefined;
    let skillTargetZs: Float32Array | undefined;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [
            count,
            ,
            identities,
            clocks,
            statuses,
            ,
            ,
            ,
            targets,
        ] = runIter.current;
        if (count === 0) continue;
        tick = clocks[RogueRunClock.Tick][0];
        phase = statuses[RogueRunStatus.Phase][0];
        swordGroup = identities[RogueRunIdentity.SwordGroup][0];
        skillTargetXs = targets[RogueRunTarget.SkillX];
        skillTargetYs = targets[RogueRunTarget.SkillY];
        skillTargetZs = targets[RogueRunTarget.SkillZ];
        break;
    }
    if (
        phase !== RogueRunPhase.Playing ||
        swordGroup === 0 ||
        skills.phase(swordGroup) !== FlyingSwordSkillPhase.Idle
    ) {
        return;
    }
    const behavior = findSwordGroupBehavior(swordGroup, swordGroups);
    if (
        behavior.stance !== FlyingSwordStance.Scatter ||
        behavior.activeFormation !== FlyingSwordActiveFormation.None
    ) {
        return;
    }
    scratch.activeTaskSwords.clear();
    const taskIter = tasks.iter();
    while (taskIter.next()) {
        const [count, entities] = taskIter.current;
        for (let row = 0; row < count; row++) {
            scratch.activeTaskSwords.add(entities[row]);
        }
    }
    let availableSwordCount = 0;
    const availabilityIter = swords.iter();
    while (availabilityIter.next()) {
        const [
            count,
            entities,
            members,
            ,
            ,
            ,
            combat,
            ,
            spirits,
        ] = availabilityIter.current;
        const swordGroups = members[FlyingSwordMember.Group];
        const nextAttackTicks =
            combat[FlyingSwordCombat.NextAttackTick];
        const currentSpirits = spirits[SwordSpiritPower.Current];
        for (let row = 0; row < count; row++) {
            if (
                swordGroups[row] === swordGroup &&
                !scratch.activeTaskSwords.has(entities[row]) &&
                tick >= nextAttackTicks[row] &&
                currentSpirits[row] >= SCATTER_SPIRIT_COST
            ) {
                availableSwordCount++;
            }
        }
    }
    if (availableSwordCount === 0) return;
    let playerX = 0;
    let playerZ = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , positions] = playerIter.current;
        if (count === 0) continue;
        playerX = positions[Float3.X][0];
        playerZ = positions[Float3.Z][0];
        break;
    }

    let targetRadiusSquared = 0;
    let launchCadenceTicks = 1;
    let launchSlotStride = 0;
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [count, entities, auto] = groupIter.current;
        const targetRadii =
            auto[AutoFlyingSwordSkill.TargetRadius];
        const launchCadences =
            auto[AutoFlyingSwordSkill.ScatterLaunchCadenceTicks];
        const launchStrides =
            auto[AutoFlyingSwordSkill.ScatterLaunchSlotStride];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== swordGroup) continue;
            targetRadiusSquared =
                targetRadii[row] * targetRadii[row];
            launchCadenceTicks = Math.max(
                1,
                launchCadences[row],
            );
            launchSlotStride = launchStrides[row];
            break;
        }
        if (targetRadiusSquared > 0) break;
    }
    if (targetRadiusSquared <= 0) return;

    targeting.reset();
    const enemyIter = enemies.iter();
    while (enemyIter.next()) {
        const [
            count,
            entities,
            positions,
            ,
            ,
            ,
            ,
            identities,
            bodies,
            ,
            health,
        ] = enemyIter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const priorities = identities[EnemyIdentity.Priority];
        const centerHeights = bodies[EnemyBody.CenterHeight];
        const currentHealth = health[Health.Current];
        for (let row = 0; row < count; row++) {
            if (currentHealth[row] <= 0) continue;
            const dx = xs[row] - playerX;
            const dz = zs[row] - playerZ;
            const distance = dx * dx + dz * dz;
            if (distance > targetRadiusSquared) continue;
            targeting.insert(
                entities[row],
                xs[row],
                ys[row] + centerHeights[row],
                zs[row],
                distance,
                priorities[row],
            );
        }
    }
    const candidateCount = targeting.count;
    if (candidateCount === 0) return;
    const sortedCandidateCount = Math.min(
        candidateCount,
        availableSwordCount,
    );
    for (let start = 0; start < sortedCandidateCount; start++) {
        targeting.swap(
            start,
            findBestTargetCandidate(targeting, start),
        );
    }

    let assignment = 0;
    const swordIter = swords.iter();
    while (swordIter.next()) {
        const [
            count,
            entities,
            members,
            ,
            ,
            ,
            combat,
            ,
            spirits,
        ] = swordIter.current;
        const swordGroups = members[FlyingSwordMember.Group];
        const swordSlots = members[FlyingSwordMember.Slot];
        const assignedTargets = combat[FlyingSwordCombat.Target];
        const nextAttackTicks =
            combat[FlyingSwordCombat.NextAttackTick];
        const currentSpirits = spirits[SwordSpiritPower.Current];
        for (let row = 0; row < count; row++) {
            const sword = entities[row];
            if (
                swordGroups[row] !== swordGroup ||
                scratch.activeTaskSwords.has(sword) ||
                tick < nextAttackTicks[row] ||
                currentSpirits[row] < SCATTER_SPIRIT_COST ||
                !shouldLaunchScatterSword(
                    tick,
                    swordSlots[row],
                    launchCadenceTicks,
                    launchSlotStride,
                )
            ) {
                continue;
            }
            const candidate =
                swordSlots[row] % candidateCount;
            castTarget.x = targeting.xs[candidate];
            castTarget.y = targeting.ys[candidate];
            castTarget.z = targeting.zs[candidate];
            assignedTargets[row] =
                targeting.entities[candidate] as Entity;
            nextAttackTicks[row] = tick + TASK_REQUEST_GUARD_TICKS;
            currentSpirits[row] -= SCATTER_SPIRIT_COST;
            flyingSwords.attack(sword, castTarget);
            assignment++;
        }
    }
    if (assignment === 0) return;

    const primaryX = targeting.xs[0];
    const primaryY = targeting.ys[0];
    const primaryZ = targeting.zs[0];
    if (skillTargetXs && skillTargetYs && skillTargetZs) {
        skillTargetXs[0] = primaryX;
        skillTargetYs[0] = primaryY;
        skillTargetZs[0] = primaryZ;
    }
}

export function shouldLaunchScatterSword(
    tick: number,
    slot: number,
    cadenceTicks: number,
    slotStride: number,
): boolean {
    return (
        tick + slot * slotStride
    ) % cadenceTicks === 0;
}

function findSwordGroupBehavior(
    group: Entity,
    groups: SwordGroups,
): { stance: number; activeFormation: number } {
    const iter = groups.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            ,
            ,
            ,
            ,
            ,
            behaviors,
        ] = iter.current;
        const stances = behaviors[FlyingSwordBehavior.Stance];
        const activeFormations =
            behaviors[FlyingSwordBehavior.ActiveFormation];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== group) continue;
            groupBehavior.stance = stances[row];
            groupBehavior.activeFormation = activeFormations[row];
            return groupBehavior;
        }
    }
    groupBehavior.stance = FlyingSwordStance.Guard;
    groupBehavior.activeFormation = FlyingSwordActiveFormation.None;
    return groupBehavior;
}

function findBestTargetCandidate(
    targeting: Readonly<FlyingSwordTargetingState>,
    start: number,
): number {
    let best = start;
    for (
        let candidate = start + 1;
        candidate < targeting.count;
        candidate++
    ) {
        if (
            targeting.priorities[candidate] >
                targeting.priorities[best] ||
            (
                targeting.priorities[candidate] ===
                    targeting.priorities[best] &&
                targeting.distances[candidate] <
                    targeting.distances[best]
            )
        ) {
            best = candidate;
        }
    }
    return best;
}

const castTarget = { x: 0, y: 0, z: 0 };
const groupBehavior = {
    stance: FlyingSwordStance.Guard as number,
    activeFormation: FlyingSwordActiveFormation.None as number,
};
const TASK_REQUEST_GUARD_TICKS = 2;
const SCATTER_SPIRIT_COST = 18;
