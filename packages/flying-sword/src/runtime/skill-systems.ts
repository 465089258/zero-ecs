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
    for (let request = 0; request < requests.count; request++) {
        const group = requests.groups[request];
        if (
            requests.kinds[request] ===
            FlyingSwordSkillRequestKind.Activate
        ) {
            const planId = requests.planIds[request];
            catalog.require(planId);
            actions.activate(
                group,
                planId,
                requests.targetXs[request],
                requests.targetYs[request],
                requests.targetZs[request],
                time.tick,
            );
        } else {
            actions.requestReturn(group, time.tick);
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
    let pending = 0;
    for (let action = 0; action < actions.count; action++) {
        if (actions.acquired[action] === ACQUIRE_PENDING_COMMIT) {
            actions.acquired[action] = ACQUIRE_READY;
            continue;
        }
        if (actions.acquired[action] !== ACQUIRE_NONE) continue;
        actions.reservedCounts[action] = 0;
        actions.remainingCounts[action] = 0;
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
            const action = actions.indices.get(groups[row]);
            if (
                action === undefined ||
                actions.acquired[action] !== ACQUIRE_NONE
            ) {
                continue;
            }
            const plan = catalog.require(actions.planIds[action]);
            const role = actions.reservedCounts[action];
            if (role >= plan.maximumSwords) {
                removeSkillComponents(
                    commands,
                    entities[row],
                    hasContactWindow,
                );
                continue;
            }
            sequences[row] = actions.sequences[action];
            phases[row] = FlyingSwordSkillPhase.Gather;
            phaseStartTicks[row] = actions.startTicks[action];
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
            actions.reservedCounts[action] = role + 1;
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
            const action = actions.indices.get(groups[row]);
            if (
                action === undefined ||
                actions.acquired[action] !== ACQUIRE_NONE
            ) {
                continue;
            }
            const plan = catalog.require(actions.planIds[action]);
            const role = actions.reservedCounts[action];
            if (role >= plan.maximumSwords) continue;
            commands
                .entity(entities[row])
                .add(FlyingSwordSkillActionStorage)
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.Sequence,
                    actions.sequences[action],
                )
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.Phase,
                    FlyingSwordSkillPhase.Gather,
                )
                .set(
                    FlyingSwordSkillActionStorage,
                    FlyingSwordAction.PhaseStartTick,
                    actions.startTicks[action],
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
            actions.reservedCounts[action] = role + 1;
        }
    }

    for (let action = 0; action < actions.count; action++) {
        if (actions.acquired[action] !== ACQUIRE_NONE) continue;
        const reserved = actions.reservedCounts[action];
        const plan = catalog.require(actions.planIds[action]);
        actions.acquired[action] = ACQUIRE_PENDING_COMMIT;
        actions.remainingCounts[action] = reserved;
        if (reserved < plan.minimumSwords) {
            actions.stages[action] = FlyingSwordSkillPhase.Return;
            actions.displayPhases[action] =
                FlyingSwordSkillPhase.Return;
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
            const action = actions.indices.get(groups[row]);
            if (
                action === undefined ||
                actions.sequences[action] !== sequences[row]
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
            if (actions.acquired[action] !== ACQUIRE_READY) {
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
                const snapshot = runtime.groups.get(groups[row]);
                if (!snapshot || snapshot.tick !== time.tick) continue;
                cachedAction = action;
                cachedPlan = catalog.require(actions.planIds[action]);
                cachedCenterX = snapshot.centerX;
                cachedCenterY = snapshot.centerY;
                cachedCenterZ = snapshot.centerZ;
                cachedTargetX = actions.targetXs[action];
                cachedTargetY = actions.targetYs[action];
                cachedTargetZ = actions.targetZs[action];
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
                    actions.reservedCounts[action],
                );
                columns = Math.max(
                    1,
                    Math.ceil(Math.sqrt(reserved)),
                );
                stage = actions.stages[action];
                stageStartTick = actions.phaseStartTicks[action];
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
                time.tick < phaseStartTicks[row]
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
                if (time.tick === phaseStartTicks[row]) {
                    trajectoryStartXs[row] = xs[row];
                    trajectoryStartYs[row] = ys[row];
                    trajectoryStartZs[row] = zs[row];
                }
                const contactActive = writeLaunchCurveMotion(
                    time.tick - phaseStartTicks[row],
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
    if (actions.count === 0) return;
    for (let action = 0; action < actions.count; action++) {
        if (actions.acquired[action] !== ACQUIRE_READY) continue;
        actions.remainingCounts[action] = 0;
        actions.gatherArrivedCounts[action] = 0;
        actions.observedMaximumPhases[action] =
            FlyingSwordSkillPhase.Gather;
        const plan = catalog.require(actions.planIds[action]);
        if (
            actions.stages[action] !== FlyingSwordSkillPhase.Return &&
            time.tick - actions.startTicks[action] >=
            plan.actionTimeoutTicks
        ) {
            actions.stages[action] = FlyingSwordSkillPhase.Return;
            actions.displayPhases[action] =
                FlyingSwordSkillPhase.Return;
            actions.phaseStartTicks[action] = time.tick;
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
            const action = actions.indices.get(groups[row]);
            if (
                action === undefined ||
                actions.sequences[action] !== sequences[row]
            ) {
                removeSkillComponents(
                    commands,
                    entities[row],
                    hasContactWindow,
                );
                continue;
            }
            if (actions.acquired[action] !== ACQUIRE_READY) continue;
            const plan = catalog.require(actions.planIds[action]);
            const dx = targetXs[row] - xs[row];
            const dy = targetYs[row] - ys[row];
            const dz = targetZs[row] - zs[row];
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            const arrived =
                distanceSquared <=
                arrivalRadii[row] * arrivalRadii[row];

            if (
                actions.stages[action] ===
                FlyingSwordSkillPhase.Gather
            ) {
                actions.remainingCounts[action]++;
                if (arrived) actions.gatherArrivedCounts[action]++;
                continue;
            }

            if (
                actions.stages[action] ===
                FlyingSwordSkillPhase.Return &&
                phases[row] !== FlyingSwordSkillPhase.Rejoin
            ) {
                phases[row] = FlyingSwordSkillPhase.Return;
                phaseStartTicks[row] = time.tick;
            }

            let phase = phases[row];
            if (
                phase === FlyingSwordSkillPhase.Launch &&
                time.tick >= phaseStartTicks[row]
            ) {
                const launchElapsed =
                    time.tick - phaseStartTicks[row];
                if (
                    launchElapsed >= plan.launchCurveTicks &&
                    arrived
                ) {
                    phase = FlyingSwordSkillPhase.Strike;
                    phases[row] = phase;
                    phaseStartTicks[row] = time.tick;
                } else if (
                    launchElapsed >= plan.launchTimeoutTicks
                ) {
                    phase = FlyingSwordSkillPhase.Return;
                    phases[row] = phase;
                    phaseStartTicks[row] = time.tick;
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
                    time.tick - phaseStartTicks[row] >=
                    plan.strikeTicks
                ) {
                    phase = FlyingSwordSkillPhase.Return;
                    phases[row] = phase;
                    phaseStartTicks[row] = time.tick;
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
                    phaseStartTicks[row] = time.tick;
                }
            } else if (phase === FlyingSwordSkillPhase.Rejoin) {
                if (
                    time.tick - phaseStartTicks[row] >=
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
            actions.remainingCounts[action]++;
            actions.observedMaximumPhases[action] = Math.max(
                actions.observedMaximumPhases[action],
                phase,
            );
        }
    }

    for (let action = 0; action < actions.count; action++) {
        if (actions.acquired[action] !== ACQUIRE_READY) continue;
        const plan = catalog.require(actions.planIds[action]);
        if (
            actions.stages[action] === FlyingSwordSkillPhase.Gather
        ) {
            const reserved = actions.reservedCounts[action];
            if (
                reserved > 0 &&
                (
                    actions.gatherArrivedCounts[action] / reserved >=
                    plan.gatherArrivalRatio ||
                    time.tick - actions.startTicks[action] >=
                    plan.gatherTicks
                )
            ) {
                actions.stages[action] =
                    FlyingSwordSkillPhase.Launch;
                actions.displayPhases[action] =
                    FlyingSwordSkillPhase.Launch;
                actions.phaseStartTicks[action] = time.tick;
            } else {
                actions.displayPhases[action] =
                    FlyingSwordSkillPhase.Gather;
            }
        } else if (actions.remainingCounts[action] > 0) {
            actions.displayPhases[action] =
                actions.observedMaximumPhases[action];
        } else if (
            actions.displayPhases[action] !==
            FlyingSwordSkillPhase.Rejoin
        ) {
            actions.displayPhases[action] =
                FlyingSwordSkillPhase.Rejoin;
            actions.phaseStartTicks[action] = time.tick;
        }
    }
}

function cleanupFlyingSwordSkills(
    time: Readonly<TimeState>,
    actions: Mut<FlyingSwordSkillActionState>,
): void {
    for (let action = actions.count - 1; action >= 0; action--) {
        if (
            actions.acquired[action] === ACQUIRE_READY &&
            actions.remainingCounts[action] === 0 &&
            actions.displayPhases[action] ===
                FlyingSwordSkillPhase.Rejoin &&
            time.tick > actions.phaseStartTicks[action]
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
