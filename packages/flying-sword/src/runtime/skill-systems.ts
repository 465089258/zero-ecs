import {
    Commands,
    Update,
    Write,
    defSystem,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import { Float3 } from "@zero-ecs/math/3d";
import {
    MotionSystemSet,
    MoveTowards3,
} from "@zero-ecs/motion/3d";
import {
    FlyingSwordSkillCatalog,
} from "../skill-catalog";
import type {
    CompiledFlyingSwordSkillPlan,
} from "../skill-types";
import { FlyingSwordSystemSet } from "../system-set";
import { FlyingSwordSkillPhase } from "../skill-types";
import {
    FlyingSwordAction,
    FlyingSwordFlight,
    FlyingSwordMember,
} from "../types";
import {
    ActiveFlyingSwordSkillStorageQuery,
    AvailableFlyingSwordStorageQuery,
    FlyingSwordGuidanceStorageQuery,
} from "./queries";
import { FlyingSwordRuntimeState } from "./runtime-state";
import { FlyingSwordSkillActionState } from "./skill-action-state";
import {
    FlyingSwordSkillRequestKind,
    FlyingSwordSkillRequestState,
} from "./skill-request-state";
import {
    FlyingSwordContactWindowStorage,
    FlyingSwordSkillActionStorage,
} from "./storage";

type AvailableSwords =
    QueryOf<typeof AvailableFlyingSwordStorageQuery>;
type ActiveSwords =
    QueryOf<typeof ActiveFlyingSwordSkillStorageQuery>;
type GuidedSwords =
    QueryOf<typeof FlyingSwordGuidanceStorageQuery>;

export const applyFlyingSwordSkillRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordSkillRequests,
    [
        TimeState,
        FlyingSwordSkillCatalog,
        Write(FlyingSwordSkillRequestState),
        Write(FlyingSwordSkillActionState),
    ],
);

export const acquireFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    acquireFlyingSwordSkills,
    [
        Commands,
        FlyingSwordSkillCatalog,
        Write(FlyingSwordSkillActionState),
        ActiveFlyingSwordSkillStorageQuery,
        AvailableFlyingSwordStorageQuery,
    ],
);

export const guideFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    guideFlyingSwordSkills,
    [
        Commands,
        TimeState,
        FlyingSwordSkillCatalog,
        FlyingSwordSkillActionState,
        FlyingSwordRuntimeState,
        FlyingSwordGuidanceStorageQuery,
    ],
);

export const resolveFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    resolveFlyingSwordSkills,
    [
        Commands,
        TimeState,
        FlyingSwordSkillCatalog,
        Write(FlyingSwordSkillActionState),
        ActiveFlyingSwordSkillStorageQuery,
    ],
);

export const cleanupFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    cleanupFlyingSwordSkills,
    [TimeState, Write(FlyingSwordSkillActionState)],
);

export const FlyingSwordSkillSystemOptions = Object.freeze({
    requests: {
        inSet: FlyingSwordSystemSet.Request,
    } as const,
    acquire: {
        inSet: FlyingSwordSystemSet.Skill,
        after: FlyingSwordSystemSet.Control,
    } as const,
    guidance: {
        inSet: FlyingSwordSystemSet.Guidance,
        after: FlyingSwordSystemSet.Formation,
        before: MotionSystemSet.Integrate3,
    } as const,
    contact: {
        inSet: FlyingSwordSystemSet.Contact,
        after: MotionSystemSet.Integrate3,
    } as const,
    cleanup: {
        inSet: FlyingSwordSystemSet.Cleanup,
        after: FlyingSwordSystemSet.Contact,
    } as const,
});

function applyFlyingSwordSkillRequests(
    time: Readonly<TimeState>,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    requests: Mut<FlyingSwordSkillRequestState>,
    actions: Mut<FlyingSwordSkillActionState>,
): void {
    const requestCount = requests.count;
    const kinds = requests.kinds;
    const groups = requests.groups;
    const planIds = requests.planIds;
    const targetXs = requests.targetXs;
    const targetYs = requests.targetYs;
    const targetZs = requests.targetZs;
    const tick = time.tick;
    for (let request = 0; request < requestCount; request++) {
        const group = groups[request];
        if (
            kinds[request] ===
            FlyingSwordSkillRequestKind.Activate
        ) {
            const planId = planIds[request];
            catalog.require(planId);
            actions.activate(
                group,
                planId,
                targetXs[request],
                targetYs[request],
                targetZs[request],
                tick,
            );
        } else {
            actions.requestReturn(group, tick);
        }
    }
    requests.clear();
}

function acquireFlyingSwordSkills(
    commands: Commands,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    actions: Mut<FlyingSwordSkillActionState>,
    activeSwords: ActiveSwords,
    availableSwords: AvailableSwords,
): void {
    const actionCount = actions.count;
    const acquired = actions.acquired;
    const reservedCounts = actions.reservedCounts;
    const remainingCounts = actions.remainingCounts;
    const indices = actions.indices;
    const planIds = actions.planIds;
    const sequencesByAction = actions.sequences;
    const startTicks = actions.startTicks;
    const stages = actions.stages;
    const displayPhases = actions.displayPhases;
    let pending = 0;
    for (let action = 0; action < actionCount; action++) {
        if (acquired[action] === ACQUIRE_PENDING_COMMIT) {
            acquired[action] = ACQUIRE_READY;
            continue;
        }
        if (acquired[action] !== ACQUIRE_NONE) continue;
        reservedCounts[action] = 0;
        remainingCounts[action] = 0;
        pending++;
    }
    if (pending === 0) return;

    // 重施放会复用已经属于同一控制组的技能动作组件。
    const activeIter = activeSwords.iter();
    while (activeIter.next()) {
        const [
            count,
            entities,
            members,
            ,
            positions,
            ,
            ,
            actionsData,
            contactWindow,
        ] = activeIter.current;
        const groups = members[FlyingSwordMember.Group];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const sequences = actionsData[FlyingSwordAction.Sequence];
        const phases = actionsData[FlyingSwordAction.Phase];
        const phaseStartTicks =
            actionsData[FlyingSwordAction.PhaseStartTick];
        const roles = actionsData[FlyingSwordAction.Role];
        const trajectoryStartXs =
            actionsData[FlyingSwordAction.TrajectoryStartX];
        const trajectoryStartYs =
            actionsData[FlyingSwordAction.TrajectoryStartY];
        const trajectoryStartZs =
            actionsData[FlyingSwordAction.TrajectoryStartZ];
        const hasContactWindow = contactWindow !== undefined;

        for (let row = 0; row < count; row++) {
            const action = indices.get(groups[row]);
            if (
                action === undefined ||
                acquired[action] !== ACQUIRE_NONE
            ) {
                continue;
            }
            const plan = catalog.require(planIds[action]);
            const role = reservedCounts[action];
            if (role >= plan.maximumSwords) {
                removeSkillComponents(
                    commands,
                    entities[row],
                    hasContactWindow,
                );
                continue;
            }
            sequences[row] = sequencesByAction[action];
            phases[row] = FlyingSwordSkillPhase.Gather;
            phaseStartTicks[row] = startTicks[action];
            roles[row] = role;
            trajectoryStartXs[row] = xs[row];
            trajectoryStartYs[row] = ys[row];
            trajectoryStartZs[row] = zs[row];
            if (hasContactWindow) {
                commands
                    .entity(entities[row])
                    .remove(FlyingSwordContactWindowStorage)
                    .submit();
            }
            reservedCounts[action] = role + 1;
        }
    }

    // 没有动作能力的飞剑通过一次结构事务进入技能 Archetype。
    const availableIter = availableSwords.iter();
    while (availableIter.next()) {
        const [count, entities, members, , positions] =
            availableIter.current;
        const groups = members[FlyingSwordMember.Group];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        for (let row = 0; row < count; row++) {
            const action = indices.get(groups[row]);
            if (
                action === undefined ||
                acquired[action] !== ACQUIRE_NONE
            ) {
                continue;
            }
            const plan = catalog.require(planIds[action]);
            const role = reservedCounts[action];
            if (role >= plan.maximumSwords) continue;
            commands
                .entity(entities[row])
                .add(FlyingSwordSkillActionStorage)
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.Sequence,
                    sequencesByAction[action],
                )
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.Phase,
                    FlyingSwordSkillPhase.Gather,
                )
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.PhaseStartTick,
                    startTicks[action],
                )
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.Role,
                    role,
                )
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.TrajectoryStartX,
                    xs[row],
                )
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.TrajectoryStartY,
                    ys[row],
                )
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.TrajectoryStartZ,
                    zs[row],
                )
                .submit();
            reservedCounts[action] = role + 1;
        }
    }

    for (let action = 0; action < actionCount; action++) {
        if (acquired[action] !== ACQUIRE_NONE) continue;
        const reserved = reservedCounts[action];
        const plan = catalog.require(planIds[action]);
        acquired[action] = ACQUIRE_PENDING_COMMIT;
        remainingCounts[action] = reserved;
        if (reserved < plan.minimumSwords) {
            stages[action] = FlyingSwordSkillPhase.Return;
            displayPhases[action] = FlyingSwordSkillPhase.Return;
        }
    }
}

function guideFlyingSwordSkills(
    commands: Commands,
    time: Readonly<TimeState>,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    actions: Readonly<FlyingSwordSkillActionState>,
    runtime: Readonly<FlyingSwordRuntimeState>,
    swords: GuidedSwords,
): void {
    const tick = time.tick;
    const actionIndices = actions.indices;
    const actionSequences = actions.sequences;
    const actionAcquired = actions.acquired;
    const actionPlanIds = actions.planIds;
    const actionTargetXs = actions.targetXs;
    const actionTargetYs = actions.targetYs;
    const actionTargetZs = actions.targetZs;
    const reservedCounts = actions.reservedCounts;
    const stages = actions.stages;
    const actionPhaseStartTicks = actions.phaseStartTicks;
    const snapshots = runtime.groups;
    const iter = swords.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            flights,
            positions,
            formationGoals,
            motion,
            actionsData,
            contactWindow,
        ] = iter.current;
        const groups = members[FlyingSwordMember.Group];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const formationGoalXs = formationGoals[Float3.X];
        const formationGoalYs = formationGoals[Float3.Y];
        const formationGoalZs = formationGoals[Float3.Z];
        const maximumSpeeds =
            flights[FlyingSwordFlight.MaximumSpeed];
        const accelerations =
            flights[FlyingSwordFlight.Acceleration];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        const motionMaximumSpeeds =
            motion[MoveTowards3.MaximumSpeed];
        const motionAccelerations =
            motion[MoveTowards3.Acceleration];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];

        if (!actionsData) {
            for (let row = 0; row < count; row++) {
                writeFormationMotion(
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    maximumSpeeds,
                    accelerations,
                    targetXs,
                    targetYs,
                    targetZs,
                    motionMaximumSpeeds,
                    motionAccelerations,
                    arrivalRadii,
                    row,
                    1,
                    DEFAULT_ARRIVAL_RADIUS,
                );
            }
            continue;
        }

        const sequences = actionsData[FlyingSwordAction.Sequence];
        const phases = actionsData[FlyingSwordAction.Phase];
        const phaseStartTicks =
            actionsData[FlyingSwordAction.PhaseStartTick];
        const roles = actionsData[FlyingSwordAction.Role];
        const trajectoryStartXs =
            actionsData[FlyingSwordAction.TrajectoryStartX];
        const trajectoryStartYs =
            actionsData[FlyingSwordAction.TrajectoryStartY];
        const trajectoryStartZs =
            actionsData[FlyingSwordAction.TrajectoryStartZ];
        const hasContactWindow = contactWindow !== undefined;

        let cachedAction = -1;
        let cachedPlan: CompiledFlyingSwordSkillPlan | undefined;
        let cachedCenterX = 0;
        let cachedCenterY = 0;
        let cachedCenterZ = 0;
        let cachedTargetX = 0;
        let cachedTargetY = 0;
        let cachedTargetZ = 0;
        let directionX = 0;
        let directionZ = 1;
        let rightX = 1;
        let rightZ = 0;
        let columns = 1;
        let reserved = 1;
        let stage: number = FlyingSwordSkillPhase.Gather;
        let stageStartTick = 0;

        for (let row = 0; row < count; row++) {
            const action = actionIndices.get(groups[row]);
            if (
                action === undefined ||
                actionSequences[action] !== sequences[row]
            ) {
                removeSkillComponents(
                    commands,
                    entities[row],
                    hasContactWindow,
                );
                writeFormationMotion(
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    maximumSpeeds,
                    accelerations,
                    targetXs,
                    targetYs,
                    targetZs,
                    motionMaximumSpeeds,
                    motionAccelerations,
                    arrivalRadii,
                    row,
                    1,
                    DEFAULT_ARRIVAL_RADIUS,
                );
                continue;
            }
            if (actionAcquired[action] !== ACQUIRE_READY) {
                writeFormationMotion(
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    maximumSpeeds,
                    accelerations,
                    targetXs,
                    targetYs,
                    targetZs,
                    motionMaximumSpeeds,
                    motionAccelerations,
                    arrivalRadii,
                    row,
                    1,
                    DEFAULT_ARRIVAL_RADIUS,
                );
                continue;
            }
            if (action !== cachedAction) {
                const snapshot = snapshots.get(groups[row]);
                if (!snapshot || snapshot.tick !== tick) continue;
                cachedAction = action;
                cachedPlan = catalog.require(actionPlanIds[action]);
                cachedCenterX = snapshot.centerX;
                cachedCenterY = snapshot.centerY;
                cachedCenterZ = snapshot.centerZ;
                cachedTargetX = actionTargetXs[action];
                cachedTargetY = actionTargetYs[action];
                cachedTargetZ = actionTargetZs[action];
                const dx = cachedTargetX - cachedCenterX;
                const dz = cachedTargetZ - cachedCenterZ;
                const length = Math.sqrt(dx * dx + dz * dz);
                if (length > 1e-6) {
                    directionX = dx / length;
                    directionZ = dz / length;
                } else {
                    directionX = 0;
                    directionZ = 1;
                }
                rightX = directionZ;
                rightZ = -directionX;
                reserved = Math.max(
                    1,
                    reservedCounts[action],
                );
                columns = Math.max(
                    1,
                    Math.ceil(Math.sqrt(reserved)),
                );
                stage = stages[action];
                stageStartTick = actionPhaseStartTicks[action];
            }

            const plan = cachedPlan;
            if (!plan) continue;
            const role = roles[row];
            if (stage === FlyingSwordSkillPhase.Return) {
                if (phases[row] !== FlyingSwordSkillPhase.Rejoin) {
                    phases[row] = FlyingSwordSkillPhase.Return;
                    phaseStartTicks[row] = stageStartTick;
                }
                if (hasContactWindow) {
                    commands
                        .entity(entities[row])
                        .remove(FlyingSwordContactWindowStorage)
                        .submit();
                }
                writeFormationMotion(
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    maximumSpeeds,
                    accelerations,
                    targetXs,
                    targetYs,
                    targetZs,
                    motionMaximumSpeeds,
                    motionAccelerations,
                    arrivalRadii,
                    row,
                    plan.returnSpeedMultiplier,
                    plan.rejoinRadius,
                );
                continue;
            }

            if (stage === FlyingSwordSkillPhase.Gather) {
                phases[row] = FlyingSwordSkillPhase.Gather;
                if (hasContactWindow) {
                    commands
                        .entity(entities[row])
                        .remove(FlyingSwordContactWindowStorage)
                        .submit();
                }
                writeGatherMotion(
                    plan,
                    cachedCenterX,
                    cachedCenterY,
                    cachedCenterZ,
                    directionX,
                    directionZ,
                    rightX,
                    rightZ,
                    columns,
                    reserved,
                    role,
                    maximumSpeeds[row],
                    accelerations[row],
                    targetXs,
                    targetYs,
                    targetZs,
                    motionMaximumSpeeds,
                    motionAccelerations,
                    arrivalRadii,
                    row,
                );
                continue;
            }

            if (phases[row] === FlyingSwordSkillPhase.Gather) {
                phases[row] = FlyingSwordSkillPhase.Launch;
                phaseStartTicks[row] = stageStartTick +
                    role % plan.launchWaveCount *
                    plan.launchIntervalTicks;
            }
            const phase = phases[row];
            if (
                phase === FlyingSwordSkillPhase.Launch &&
                tick < phaseStartTicks[row]
            ) {
                writeGatherMotion(
                    plan,
                    cachedCenterX,
                    cachedCenterY,
                    cachedCenterZ,
                    directionX,
                    directionZ,
                    rightX,
                    rightZ,
                    columns,
                    reserved,
                    role,
                    maximumSpeeds[row],
                    accelerations[row],
                    targetXs,
                    targetYs,
                    targetZs,
                    motionMaximumSpeeds,
                    motionAccelerations,
                    arrivalRadii,
                    row,
                );
            } else if (phase === FlyingSwordSkillPhase.Launch) {
                const lateral = strikeLateral(
                    role,
                    reserved,
                    plan.strikeSpread,
                );
                if (tick === phaseStartTicks[row]) {
                    trajectoryStartXs[row] = xs[row];
                    trajectoryStartYs[row] = ys[row];
                    trajectoryStartZs[row] = zs[row];
                }
                const contactActive = writeLaunchCurveMotion(
                    tick - phaseStartTicks[row],
                    plan,
                    maximumSpeeds[row],
                    accelerations[row],
                    trajectoryStartXs[row],
                    trajectoryStartYs[row],
                    trajectoryStartZs[row],
                    cachedTargetX,
                    cachedTargetY,
                    cachedTargetZ,
                    directionX,
                    directionZ,
                    rightX,
                    rightZ,
                    lateral,
                    targetXs,
                    targetYs,
                    targetZs,
                    motionMaximumSpeeds,
                    motionAccelerations,
                    arrivalRadii,
                    row,
                );
                updateContactWindow(
                    commands,
                    entities[row],
                    hasContactWindow,
                    contactActive,
                );
            } else if (phase === FlyingSwordSkillPhase.Strike) {
                const lateral = strikeLateral(
                    role,
                    reserved,
                    plan.strikeSpread,
                );
                targetXs[row] =
                    cachedTargetX +
                    directionX * plan.passDistance +
                    rightX * lateral;
                targetYs[row] =
                    cachedTargetY + plan.strikeHeight;
                targetZs[row] =
                    cachedTargetZ +
                    directionZ * plan.passDistance +
                    rightZ * lateral;
                arrivalRadii[row] =
                    SKILL_TARGET_ARRIVAL_RADIUS;
                motionMaximumSpeeds[row] =
                    maximumSpeeds[row] *
                    plan.strikeSpeedMultiplier;
                motionAccelerations[row] =
                    accelerations[row] *
                    plan.strikeSpeedMultiplier;
                updateContactWindow(
                    commands,
                    entities[row],
                    hasContactWindow,
                    true,
                );
            } else {
                updateContactWindow(
                    commands,
                    entities[row],
                    hasContactWindow,
                    false,
                );
                writeFormationMotion(
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    maximumSpeeds,
                    accelerations,
                    targetXs,
                    targetYs,
                    targetZs,
                    motionMaximumSpeeds,
                    motionAccelerations,
                    arrivalRadii,
                    row,
                    plan.returnSpeedMultiplier,
                    plan.rejoinRadius,
                );
            }
        }
    }
}

function resolveFlyingSwordSkills(
    commands: Commands,
    time: Readonly<TimeState>,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    actions: Mut<FlyingSwordSkillActionState>,
    swords: ActiveSwords,
): void {
    const actionCount = actions.count;
    if (actionCount === 0) return;
    const tick = time.tick;
    const acquired = actions.acquired;
    const remainingCounts = actions.remainingCounts;
    const gatherArrivedCounts = actions.gatherArrivedCounts;
    const observedMaximumPhases = actions.observedMaximumPhases;
    const planIds = actions.planIds;
    const stages = actions.stages;
    const startTicks = actions.startTicks;
    const displayPhases = actions.displayPhases;
    const actionPhaseStartTicks = actions.phaseStartTicks;
    const actionSequences = actions.sequences;
    const reservedCounts = actions.reservedCounts;
    const indices = actions.indices;
    for (let action = 0; action < actionCount; action++) {
        if (acquired[action] !== ACQUIRE_READY) continue;
        remainingCounts[action] = 0;
        gatherArrivedCounts[action] = 0;
        observedMaximumPhases[action] =
            FlyingSwordSkillPhase.Gather;
        const plan = catalog.require(planIds[action]);
        if (
            stages[action] !== FlyingSwordSkillPhase.Return &&
            tick - startTicks[action] >=
            plan.actionTimeoutTicks
        ) {
            stages[action] = FlyingSwordSkillPhase.Return;
            displayPhases[action] = FlyingSwordSkillPhase.Return;
            actionPhaseStartTicks[action] = tick;
        }
    }

    const iter = swords.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            ,
            positions,
            ,
            motion,
            actionsData,
            contactWindow,
        ] = iter.current;
        const groups = members[FlyingSwordMember.Group];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];
        const sequences = actionsData[FlyingSwordAction.Sequence];
        const phases = actionsData[FlyingSwordAction.Phase];
        const phaseStartTicks =
            actionsData[FlyingSwordAction.PhaseStartTick];
        const hasContactWindow = contactWindow !== undefined;

        for (let row = 0; row < count; row++) {
            const action = indices.get(groups[row]);
            if (
                action === undefined ||
                actionSequences[action] !== sequences[row]
            ) {
                removeSkillComponents(
                    commands,
                    entities[row],
                    hasContactWindow,
                );
                continue;
            }
            if (acquired[action] !== ACQUIRE_READY) continue;
            const plan = catalog.require(planIds[action]);
            const dx = targetXs[row] - xs[row];
            const dy = targetYs[row] - ys[row];
            const dz = targetZs[row] - zs[row];
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            const arrived =
                distanceSquared <=
                arrivalRadii[row] * arrivalRadii[row];

            if (
                stages[action] ===
                FlyingSwordSkillPhase.Gather
            ) {
                remainingCounts[action]++;
                if (arrived) gatherArrivedCounts[action]++;
                continue;
            }

            if (
                stages[action] ===
                FlyingSwordSkillPhase.Return &&
                phases[row] !== FlyingSwordSkillPhase.Rejoin
            ) {
                phases[row] = FlyingSwordSkillPhase.Return;
                phaseStartTicks[row] = tick;
            }

            let phase = phases[row];
            if (
                phase === FlyingSwordSkillPhase.Launch &&
                tick >= phaseStartTicks[row]
            ) {
                const launchElapsed =
                    tick - phaseStartTicks[row];
                if (
                    launchElapsed >= plan.launchCurveTicks &&
                    arrived
                ) {
                    phase = FlyingSwordSkillPhase.Strike;
                    phases[row] = phase;
                    phaseStartTicks[row] = tick;
                } else if (
                    launchElapsed >= plan.launchTimeoutTicks
                ) {
                    phase = FlyingSwordSkillPhase.Return;
                    phases[row] = phase;
                    phaseStartTicks[row] = tick;
                    updateContactWindow(
                        commands,
                        entities[row],
                        hasContactWindow,
                        false,
                    );
                }
            } else if (phase === FlyingSwordSkillPhase.Strike) {
                if (
                    arrived ||
                    tick - phaseStartTicks[row] >=
                    plan.strikeTicks
                ) {
                    phase = FlyingSwordSkillPhase.Return;
                    phases[row] = phase;
                    phaseStartTicks[row] = tick;
                    updateContactWindow(
                        commands,
                        entities[row],
                        hasContactWindow,
                        false,
                    );
                }
            } else if (phase === FlyingSwordSkillPhase.Return) {
                if (arrived) {
                    phase = FlyingSwordSkillPhase.Rejoin;
                    phases[row] = phase;
                    phaseStartTicks[row] = tick;
                }
            } else if (phase === FlyingSwordSkillPhase.Rejoin) {
                if (
                    tick - phaseStartTicks[row] >=
                    plan.rejoinTicks
                ) {
                    removeSkillComponents(
                        commands,
                        entities[row],
                        hasContactWindow,
                    );
                    continue;
                }
            }
            remainingCounts[action]++;
            observedMaximumPhases[action] = Math.max(
                observedMaximumPhases[action],
                phase,
            );
        }
    }

    for (let action = 0; action < actionCount; action++) {
        if (acquired[action] !== ACQUIRE_READY) continue;
        const plan = catalog.require(planIds[action]);
        if (
            stages[action] === FlyingSwordSkillPhase.Gather
        ) {
            const reserved = reservedCounts[action];
            if (
                reserved > 0 &&
                (
                    gatherArrivedCounts[action] / reserved >=
                    plan.gatherArrivalRatio ||
                    tick - startTicks[action] >=
                    plan.gatherTicks
                )
            ) {
                stages[action] = FlyingSwordSkillPhase.Launch;
                displayPhases[action] = FlyingSwordSkillPhase.Launch;
                actionPhaseStartTicks[action] = tick;
            } else {
                displayPhases[action] = FlyingSwordSkillPhase.Gather;
            }
        } else if (remainingCounts[action] > 0) {
            displayPhases[action] = observedMaximumPhases[action];
        } else if (
            displayPhases[action] !==
            FlyingSwordSkillPhase.Rejoin
        ) {
            displayPhases[action] = FlyingSwordSkillPhase.Rejoin;
            actionPhaseStartTicks[action] = tick;
        }
    }
}

function cleanupFlyingSwordSkills(
    time: Readonly<TimeState>,
    actions: Mut<FlyingSwordSkillActionState>,
): void {
    const acquired = actions.acquired;
    const remainingCounts = actions.remainingCounts;
    const displayPhases = actions.displayPhases;
    const phaseStartTicks = actions.phaseStartTicks;
    const tick = time.tick;
    for (let action = actions.count - 1; action >= 0; action--) {
        if (
            acquired[action] === ACQUIRE_READY &&
            remainingCounts[action] === 0 &&
            displayPhases[action] ===
                FlyingSwordSkillPhase.Rejoin &&
            tick > phaseStartTicks[action]
        ) {
            actions.remove(action);
        }
    }
}

function writeGatherMotion(
    plan: CompiledFlyingSwordSkillPlan,
    centerX: number,
    centerY: number,
    centerZ: number,
    directionX: number,
    directionZ: number,
    rightX: number,
    rightZ: number,
    columns: number,
    reserved: number,
    role: number,
    maximumSpeed: number,
    acceleration: number,
    targetXs: Float32Array,
    targetYs: Float32Array,
    targetZs: Float32Array,
    motionMaximumSpeeds: Float32Array,
    motionAccelerations: Float32Array,
    arrivalRadii: Float32Array,
    row: number,
): void {
    const gatherRow = Math.floor(role / columns);
    const rowStart = gatherRow * columns;
    const rowCount = Math.min(columns, reserved - rowStart);
    const column = role - rowStart;
    const rows = Math.ceil(reserved / columns);
    const lateral =
        (column - (rowCount - 1) * 0.5) * plan.gatherSpacing;
    const longitudinal =
        (gatherRow - (rows - 1) * 0.5) * plan.gatherSpacing;
    const depth = plan.gatherDistance + longitudinal;
    targetXs[row] =
        centerX - directionX * depth + rightX * lateral;
    targetYs[row] =
        centerY +
        plan.gatherHeight +
        gatherRow % 3 * plan.gatherSpacing * 0.18;
    targetZs[row] =
        centerZ - directionZ * depth + rightZ * lateral;
    arrivalRadii[row] = plan.gatherArrivalRadius;
    motionMaximumSpeeds[row] =
        maximumSpeed * plan.gatherSpeedMultiplier;
    motionAccelerations[row] =
        acceleration * plan.gatherSpeedMultiplier;
}

function writeLaunchCurveMotion(
    elapsedTicks: number,
    plan: CompiledFlyingSwordSkillPlan,
    maximumSpeed: number,
    acceleration: number,
    startX: number,
    startY: number,
    startZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    directionX: number,
    directionZ: number,
    rightX: number,
    rightZ: number,
    lateral: number,
    targetXs: Float32Array,
    targetYs: Float32Array,
    targetZs: Float32Array,
    motionMaximumSpeeds: Float32Array,
    motionAccelerations: Float32Array,
    arrivalRadii: Float32Array,
    row: number,
): boolean {
    const t = Math.min(
        1,
        (elapsedTicks + plan.launchLookaheadTicks) /
        plan.launchCurveTicks,
    );
    const inverseT = 1 - t;
    const startWeight = inverseT * inverseT * inverseT;
    const firstControlWeight = 3 * inverseT * inverseT * t;
    const secondControlWeight = 3 * inverseT * t * t;
    const targetWeight = t * t * t;
    const endX = targetX + rightX * lateral;
    const endY = targetY + plan.strikeHeight;
    const endZ = targetZ + rightZ * lateral;
    const peakY = Math.max(startY, endY) + plan.launchAscentHeight;
    const turnX = endX - directionX * plan.launchTurnDistance;
    const turnZ = endZ - directionZ * plan.launchTurnDistance;

    targetXs[row] =
        startWeight * startX +
        firstControlWeight * startX +
        secondControlWeight * turnX +
        targetWeight * endX;
    targetYs[row] =
        startWeight * startY +
        firstControlWeight * peakY +
        secondControlWeight * peakY +
        targetWeight * endY;
    targetZs[row] =
        startWeight * startZ +
        firstControlWeight * startZ +
        secondControlWeight * turnZ +
        targetWeight * endZ;
    arrivalRadii[row] = SKILL_TARGET_ARRIVAL_RADIUS;
    motionMaximumSpeeds[row] =
        maximumSpeed * plan.launchSpeedMultiplier;
    motionAccelerations[row] =
        acceleration * plan.launchSpeedMultiplier;
    return t >= LAUNCH_CONTACT_START;
}

function writeFormationMotion(
    formationGoalXs: Float32Array,
    formationGoalYs: Float32Array,
    formationGoalZs: Float32Array,
    maximumSpeeds: Float32Array,
    accelerations: Float32Array,
    targetXs: Float32Array,
    targetYs: Float32Array,
    targetZs: Float32Array,
    motionMaximumSpeeds: Float32Array,
    motionAccelerations: Float32Array,
    arrivalRadii: Float32Array,
    row: number,
    speedMultiplier: number,
    arrivalRadius: number,
): void {
    targetXs[row] = formationGoalXs[row];
    targetYs[row] = formationGoalYs[row];
    targetZs[row] = formationGoalZs[row];
    motionMaximumSpeeds[row] =
        maximumSpeeds[row] * speedMultiplier;
    motionAccelerations[row] =
        accelerations[row] * speedMultiplier;
    arrivalRadii[row] = arrivalRadius;
}

function updateContactWindow(
    commands: Commands,
    entity: Entity,
    hasContactWindow: boolean,
    active: boolean,
): void {
    if (active === hasContactWindow) return;
    const command = commands.entity(entity);
    if (active) command.add(FlyingSwordContactWindowStorage);
    else command.remove(FlyingSwordContactWindowStorage);
    command.submit();
}

function removeSkillComponents(
    commands: Commands,
    entity: Entity,
    hasContactWindow: boolean,
): void {
    const command = commands
        .entity(entity)
        .remove(FlyingSwordSkillActionStorage);
    if (hasContactWindow) {
        command.remove(FlyingSwordContactWindowStorage);
    }
    command.submit();
}

function strikeLateral(
    role: number,
    reserved: number,
    spread: number,
): number {
    if (reserved <= 1) return 0;
    return (role / (reserved - 1) - 0.5) * spread;
}

const ACQUIRE_NONE = 0;
const ACQUIRE_READY = 1;
const ACQUIRE_PENDING_COMMIT = 2;
const DEFAULT_ARRIVAL_RADIUS = 0.15;
const SKILL_TARGET_ARRIVAL_RADIUS = 0.62;
const LAUNCH_CONTACT_START = 0.72;
