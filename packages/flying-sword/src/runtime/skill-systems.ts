import {
    Commands,
    Update,
    World,
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
    FlyingSwordSkillAction,
    FlyingSwordSkillProgress,
    FlyingSwordSkillTiming,
} from "../types";
import {
    ActiveFlyingSwordSkillStorageQuery,
    AvailableFlyingSwordStorageQuery,
    CancelFlyingSwordSkillRequestStorageQuery,
    CastFlyingSwordSkillRequestStorageQuery,
    FlyingSwordGuidanceStorageQuery,
    FlyingSwordSkillActionEntityStorageQuery,
} from "./queries";
import { FlyingSwordGroupIndexState } from "./runtime-state";
import {
    FlyingSwordSkillActionIndexState,
    FlyingSwordSkillSequenceState,
} from "./skill-action-state";
import {
    CancelFlyingSwordSkillRequest,
    CastFlyingSwordSkillRequest,
    FlyingSwordSkillAcquisition,
    FlyingSwordSkillAcquisitionStorage,
    FlyingSwordSkillActionEntityStorage,
    FlyingSwordContactWindowStorage,
    FlyingSwordSkillActionStorage,
    FlyingSwordSkillProgressStorage,
    FlyingSwordSkillTarget3Storage,
    FlyingSwordSkillTimingStorage,
    FlyingSwordGroupStorage,
} from "./storage";

type AvailableSwords =
    QueryOf<typeof AvailableFlyingSwordStorageQuery>;
type ActiveSwords =
    QueryOf<typeof ActiveFlyingSwordSkillStorageQuery>;
type GuidedSwords =
    QueryOf<typeof FlyingSwordGuidanceStorageQuery>;
type ActionEntities =
    QueryOf<typeof FlyingSwordSkillActionEntityStorageQuery>;
type CastRequests =
    QueryOf<typeof CastFlyingSwordSkillRequestStorageQuery>;
type CancelRequests =
    QueryOf<typeof CancelFlyingSwordSkillRequestStorageQuery>;

export const snapshotFlyingSwordSkillActionsSystem = defSystem(
    Update.fixed,
    snapshotFlyingSwordSkillActions,
    [
        TimeState,
        Write(FlyingSwordSkillActionIndexState),
        FlyingSwordSkillActionEntityStorageQuery,
    ],
);

export const applyFlyingSwordSkillRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordSkillRequests,
    [
        TimeState,
        FlyingSwordSkillCatalog,
        Commands,
        World,
        Write(FlyingSwordSkillActionIndexState),
        Write(FlyingSwordSkillSequenceState),
        CastFlyingSwordSkillRequestStorageQuery,
        CancelFlyingSwordSkillRequestStorageQuery,
    ],
);

export const acquireFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    acquireFlyingSwordSkills,
    [
        Commands,
        FlyingSwordSkillCatalog,
        Write(FlyingSwordSkillActionIndexState),
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
        FlyingSwordSkillActionIndexState,
        FlyingSwordGroupIndexState,
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
        Write(FlyingSwordSkillActionIndexState),
        ActiveFlyingSwordSkillStorageQuery,
    ],
);

export const cleanupFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    cleanupFlyingSwordSkills,
    [
        Commands,
        TimeState,
        Write(FlyingSwordSkillActionIndexState),
        FlyingSwordSkillActionEntityStorageQuery,
    ],
);

export const FlyingSwordSkillSystemOptions = Object.freeze({
    actionIndex: {
        inSet: FlyingSwordSystemSet.Request,
    } as const,
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
        after: [
            MotionSystemSet.Integrate3,
            FlyingSwordSystemSet.Orientation,
        ],
    } as const,
    cleanup: {
        inSet: FlyingSwordSystemSet.Cleanup,
        after: FlyingSwordSystemSet.Contact,
    } as const,
});

function snapshotFlyingSwordSkillActions(
    time: Readonly<TimeState>,
    actions: Mut<FlyingSwordSkillActionIndexState>,
    actionEntities: ActionEntities,
): void {
    const tick = time.tick;
    const iter = actionEntities.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            identities,
            targets,
            timings,
            acquisitions,
            progresses,
        ] = iter.current;
        const groups = identities[FlyingSwordSkillAction.Group];
        const planIds = identities[FlyingSwordSkillAction.Plan];
        const sequences =
            identities[FlyingSwordSkillAction.Sequence];
        const targetXs = targets[Float3.X];
        const targetYs = targets[Float3.Y];
        const targetZs = targets[Float3.Z];
        const startTicks =
            timings[FlyingSwordSkillTiming.StartTick];
        const phaseStartTicks =
            timings[FlyingSwordSkillTiming.PhaseStartTick];
        const stages = timings[FlyingSwordSkillTiming.Stage];
        const displayPhases =
            timings[FlyingSwordSkillTiming.DisplayPhase];
        const acquired =
            acquisitions[FlyingSwordSkillAcquisition.State];
        const reservedCounts =
            progresses[FlyingSwordSkillProgress.ReservedCount];
        const remainingCounts =
            progresses[FlyingSwordSkillProgress.RemainingCount];
        const gatherArrivedCounts =
            progresses[FlyingSwordSkillProgress.GatherArrivedCount];
        const observedMaximumPhases =
            progresses[FlyingSwordSkillProgress.ObservedMaximumPhase];
        for (let row = 0; row < count; row++) {
            const entity = entities[row];
            let action = actions.entityIndices.get(entity);
            if (action === undefined) {
                action = actions.count++;
                actions.entityIndices.set(entity, action);
            } else {
                const previousGroup = actions.groups[action];
                if (previousGroup !== groups[row]) {
                    actions.indices.delete(previousGroup);
                    actions.groupActions.delete(previousGroup);
                }
            }
            const group = groups[row];
            actions.entities[action] = entity;
            actions.groups[action] = group;
            actions.planIds[action] = planIds[row];
            actions.sequences[action] = sequences[row];
            actions.targetXs[action] = targetXs[row];
            actions.targetYs[action] = targetYs[row];
            actions.targetZs[action] = targetZs[row];
            actions.startTicks[action] = startTicks[row];
            actions.phaseStartTicks[action] =
                phaseStartTicks[row];
            actions.stages[action] = stages[row];
            actions.displayPhases[action] = displayPhases[row];
            actions.acquired[action] = acquired[row];
            actions.reservedCounts[action] = reservedCounts[row];
            actions.remainingCounts[action] = remainingCounts[row];
            actions.gatherArrivedCounts[action] =
                gatherArrivedCounts[row];
            actions.observedMaximumPhases[action] =
                observedMaximumPhases[row];
            actions.marks[action] = tick;
            actions.visible[action] = 1;
            actions.indices.set(group, action);
            actions.groupActions.set(group, entity);
        }
    }
    for (let action = actions.count - 1; action >= 0; action--) {
        if (actions.marks[action] !== tick) {
            removeActionIndex(actions, action);
        }
    }
}

function applyFlyingSwordSkillRequests(
    time: Readonly<TimeState>,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    commands: Commands,
    world: World,
    actions: Mut<FlyingSwordSkillActionIndexState>,
    sequenceState: Mut<FlyingSwordSkillSequenceState>,
    castRequests: CastRequests,
    cancelRequests: CancelRequests,
): void {
    const tick = time.tick;
    const castIter = castRequests.iter();
    while (castIter.next()) {
        const [count, entities, data] = castIter.current;
        const groups = data[CastFlyingSwordSkillRequest.Group];
        const planIds = data[CastFlyingSwordSkillRequest.Plan];
        const targetXs =
            data[CastFlyingSwordSkillRequest.TargetX];
        const targetYs =
            data[CastFlyingSwordSkillRequest.TargetY];
        const targetZs =
            data[CastFlyingSwordSkillRequest.TargetZ];
        for (let request = 0; request < count; request++) {
            const group = groups[request];
            const planId = planIds[request];
            catalog.require(planId);
            if (!world.has(group, FlyingSwordGroupStorage)) {
                commands.entity(entities[request]).despawn().submit();
                continue;
            }
            let action = actions.indices.get(group);
            if (action === undefined) {
                const sequence = takeSequence(sequenceState);
                const command = commands.spawn();
                action = actions.count++;
                const entity = command.entity;
                actions.entities[action] = entity;
                actions.groups[action] = group;
                actions.sequences[action] = sequence;
                actions.entityIndices.set(entity, action);
                actions.indices.set(group, action);
                actions.groupActions.set(group, entity);
                actions.visible[action] = 0;
                actions.marks[action] = tick;
                command
                    .add(FlyingSwordSkillActionEntityStorage)
                    .add(FlyingSwordSkillTarget3Storage)
                    .add(FlyingSwordSkillTimingStorage)
                    .add(FlyingSwordSkillAcquisitionStorage)
                    .add(FlyingSwordSkillProgressStorage)
                    .set(
                        FlyingSwordSkillActionEntityStorage,
                        FlyingSwordSkillAction.Group,
                        group,
                    )
                    .set(
                        FlyingSwordSkillActionEntityStorage,
                        FlyingSwordSkillAction.Plan,
                        planId,
                    )
                    .set(
                        FlyingSwordSkillActionEntityStorage,
                        FlyingSwordSkillAction.Sequence,
                        sequence,
                    )
                    .set(
                        FlyingSwordSkillTarget3Storage,
                        Float3.X,
                        targetXs[request],
                    )
                    .set(
                        FlyingSwordSkillTarget3Storage,
                        Float3.Y,
                        targetYs[request],
                    )
                    .set(
                        FlyingSwordSkillTarget3Storage,
                        Float3.Z,
                        targetZs[request],
                    )
                    .set(
                        FlyingSwordSkillTimingStorage,
                        FlyingSwordSkillTiming.StartTick,
                        tick,
                    )
                    .set(
                        FlyingSwordSkillTimingStorage,
                        FlyingSwordSkillTiming.PhaseStartTick,
                        tick,
                    )
                    .set(
                        FlyingSwordSkillTimingStorage,
                        FlyingSwordSkillTiming.Stage,
                        FlyingSwordSkillPhase.Gather,
                    )
                    .set(
                        FlyingSwordSkillTimingStorage,
                        FlyingSwordSkillTiming.DisplayPhase,
                        FlyingSwordSkillPhase.Gather,
                    )
                    .set(
                        FlyingSwordSkillAcquisitionStorage,
                        FlyingSwordSkillAcquisition.State,
                        ACQUIRE_NONE,
                    )
                    .set(
                        FlyingSwordSkillProgressStorage,
                        FlyingSwordSkillProgress.ReservedCount,
                        0,
                    )
                    .set(
                        FlyingSwordSkillProgressStorage,
                        FlyingSwordSkillProgress.RemainingCount,
                        0,
                    )
                    .set(
                        FlyingSwordSkillProgressStorage,
                        FlyingSwordSkillProgress.GatherArrivedCount,
                        0,
                    )
                    .set(
                        FlyingSwordSkillProgressStorage,
                        FlyingSwordSkillProgress.ObservedMaximumPhase,
                        FlyingSwordSkillPhase.Gather,
                    )
                    .submit();
            }
            actions.planIds[action] = planId;
            actions.targetXs[action] = targetXs[request];
            actions.targetYs[action] = targetYs[request];
            actions.targetZs[action] = targetZs[request];
            actions.startTicks[action] = tick;
            actions.phaseStartTicks[action] = tick;
            actions.stages[action] = FlyingSwordSkillPhase.Gather;
            actions.displayPhases[action] =
                FlyingSwordSkillPhase.Gather;
            actions.acquired[action] = ACQUIRE_NONE;
            actions.reservedCounts[action] = 0;
            actions.remainingCounts[action] = 0;
            actions.gatherArrivedCounts[action] = 0;
            actions.observedMaximumPhases[action] =
                FlyingSwordSkillPhase.Gather;
            if (actions.visible[action] !== 1) {
                commands
                    .entity(actions.entities[action])
                    .set(
                        FlyingSwordSkillActionEntityStorage,
                        FlyingSwordSkillAction.Plan,
                        planId,
                    )
                    .set(
                        FlyingSwordSkillTarget3Storage,
                        Float3.X,
                        targetXs[request],
                    )
                    .set(
                        FlyingSwordSkillTarget3Storage,
                        Float3.Y,
                        targetYs[request],
                    )
                    .set(
                        FlyingSwordSkillTarget3Storage,
                        Float3.Z,
                        targetZs[request],
                    )
                    .set(
                        FlyingSwordSkillTimingStorage,
                        FlyingSwordSkillTiming.StartTick,
                        tick,
                    )
                    .set(
                        FlyingSwordSkillTimingStorage,
                        FlyingSwordSkillTiming.PhaseStartTick,
                        tick,
                    )
                    .set(
                        FlyingSwordSkillTimingStorage,
                        FlyingSwordSkillTiming.Stage,
                        FlyingSwordSkillPhase.Gather,
                    )
                    .set(
                        FlyingSwordSkillTimingStorage,
                        FlyingSwordSkillTiming.DisplayPhase,
                        FlyingSwordSkillPhase.Gather,
                    )
                    .submit();
            }
            commands.entity(entities[request]).despawn().submit();
        }
    }

    const cancelIter = cancelRequests.iter();
    while (cancelIter.next()) {
        const [count, entities, data] = cancelIter.current;
        const groups = data[CancelFlyingSwordSkillRequest.Group];
        for (let request = 0; request < count; request++) {
            const action = actions.indices.get(groups[request]);
            if (action !== undefined) {
                actions.stages[action] =
                    FlyingSwordSkillPhase.Return;
                actions.displayPhases[action] =
                    FlyingSwordSkillPhase.Return;
                actions.phaseStartTicks[action] = tick;
                if (actions.visible[action] !== 1) {
                    commands
                        .entity(actions.entities[action])
                        .set(
                            FlyingSwordSkillTimingStorage,
                            FlyingSwordSkillTiming.Stage,
                            FlyingSwordSkillPhase.Return,
                        )
                        .set(
                            FlyingSwordSkillTimingStorage,
                            FlyingSwordSkillTiming.DisplayPhase,
                            FlyingSwordSkillPhase.Return,
                        )
                        .set(
                            FlyingSwordSkillTimingStorage,
                            FlyingSwordSkillTiming.PhaseStartTick,
                            tick,
                        )
                        .submit();
                }
            }
            commands.entity(entities[request]).despawn().submit();
        }
    }
}

function acquireFlyingSwordSkills(
    commands: Commands,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    actions: Mut<FlyingSwordSkillActionIndexState>,
    activeSwords: ActiveSwords,
    availableSwords: AvailableSwords,
): void {
    const actionCount = actions.count;
    const acquired = actions.acquired;
    const reservedCounts = actions.reservedCounts;
    const remainingCounts = actions.remainingCounts;
    const indices = actions.indices;
    const planIds = actions.planIds;
    const actionEntities = actions.entities;
    const visible = actions.visible;
    const startTicks = actions.startTicks;
    const stages = actions.stages;
    const displayPhases = actions.displayPhases;
    let pending = 0;
    for (let action = 0; action < actionCount; action++) {
        if (visible[action] !== 1) continue;
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
        const actionRefs = actionsData[FlyingSwordAction.Action];
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
                visible[action] !== 1 ||
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
            actionRefs[row] = actionEntities[action];
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
                visible[action] !== 1 ||
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
                    FlyingSwordAction.Action,
                    actionEntities[action],
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
    actions: Readonly<FlyingSwordSkillActionIndexState>,
    runtime: Readonly<FlyingSwordGroupIndexState>,
    swords: GuidedSwords,
): void {
    const tick = time.tick;
    const actionIndices = actions.indices;
    const actionEntities = actions.entities;
    const actionAcquired = actions.acquired;
    const actionPlanIds = actions.planIds;
    const actionTargetXs = actions.targetXs;
    const actionTargetYs = actions.targetYs;
    const actionTargetZs = actions.targetZs;
    const reservedCounts = actions.reservedCounts;
    const stages = actions.stages;
    const actionPhaseStartTicks = actions.phaseStartTicks;
    const groupIndices = runtime.indices;
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

        const actionRefs = actionsData[FlyingSwordAction.Action];
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
                actionEntities[action] !== actionRefs[row]
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
                const group = groupIndices.get(groups[row]);
                if (
                    group === undefined ||
                    runtime.marks[group] !== tick
                ) {
                    continue;
                }
                cachedAction = action;
                cachedPlan = catalog.require(actionPlanIds[action]);
                cachedCenterX = runtime.centerXs[group];
                cachedCenterY = runtime.centerYs[group];
                cachedCenterZ = runtime.centerZs[group];
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
    actions: Mut<FlyingSwordSkillActionIndexState>,
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
    const actionEntities = actions.entities;
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
        const actionRefs = actionsData[FlyingSwordAction.Action];
        const phases = actionsData[FlyingSwordAction.Phase];
        const phaseStartTicks =
            actionsData[FlyingSwordAction.PhaseStartTick];
        const hasContactWindow = contactWindow !== undefined;

        for (let row = 0; row < count; row++) {
            const action = indices.get(groups[row]);
            if (
                action === undefined ||
                actionEntities[action] !== actionRefs[row]
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
    commands: Commands,
    time: Readonly<TimeState>,
    actions: Mut<FlyingSwordSkillActionIndexState>,
    actionEntities: ActionEntities,
): void {
    const tick = time.tick;
    const iter = actionEntities.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            identities,
            targets,
            timings,
            acquisitions,
            progresses,
        ] = iter.current;
        const planIds = identities[FlyingSwordSkillAction.Plan];
        const targetXs = targets[Float3.X];
        const targetYs = targets[Float3.Y];
        const targetZs = targets[Float3.Z];
        const startTicks =
            timings[FlyingSwordSkillTiming.StartTick];
        const phaseStartTicks =
            timings[FlyingSwordSkillTiming.PhaseStartTick];
        const stages = timings[FlyingSwordSkillTiming.Stage];
        const displayPhases =
            timings[FlyingSwordSkillTiming.DisplayPhase];
        const acquired =
            acquisitions[FlyingSwordSkillAcquisition.State];
        const reservedCounts =
            progresses[FlyingSwordSkillProgress.ReservedCount];
        const remainingCounts =
            progresses[FlyingSwordSkillProgress.RemainingCount];
        const gatherArrivedCounts =
            progresses[FlyingSwordSkillProgress.GatherArrivedCount];
        const observedMaximumPhases =
            progresses[FlyingSwordSkillProgress.ObservedMaximumPhase];
        for (let row = 0; row < count; row++) {
            const action = actions.entityIndices.get(entities[row]);
            if (action === undefined) continue;
            if (
                actions.acquired[action] === ACQUIRE_READY &&
                actions.remainingCounts[action] === 0 &&
                actions.displayPhases[action] ===
                    FlyingSwordSkillPhase.Rejoin &&
                tick > actions.phaseStartTicks[action]
            ) {
                commands.entity(entities[row]).despawn().submit();
                removeActionIndex(actions, action);
                continue;
            }
            planIds[row] = actions.planIds[action];
            targetXs[row] = actions.targetXs[action];
            targetYs[row] = actions.targetYs[action];
            targetZs[row] = actions.targetZs[action];
            startTicks[row] = actions.startTicks[action];
            phaseStartTicks[row] =
                actions.phaseStartTicks[action];
            stages[row] = actions.stages[action];
            displayPhases[row] = actions.displayPhases[action];
            acquired[row] = actions.acquired[action];
            reservedCounts[row] = actions.reservedCounts[action];
            remainingCounts[row] =
                actions.remainingCounts[action];
            gatherArrivedCounts[row] =
                actions.gatherArrivedCounts[action];
            observedMaximumPhases[row] =
                actions.observedMaximumPhases[action];
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

function takeSequence(
    state: Mut<FlyingSwordSkillSequenceState>,
): number {
    const sequence = state.next;
    state.next = (sequence + 1) >>> 0;
    if (state.next === 0) state.next = 1;
    return sequence;
}

function removeActionIndex(
    actions: Mut<FlyingSwordSkillActionIndexState>,
    action: number,
): void {
    const last = actions.count - 1;
    if (action < 0 || action > last) return;
    const entity = actions.entities[action];
    const group = actions.groups[action];
    actions.entityIndices.delete(entity);
    if (actions.indices.get(group) === action) {
        actions.indices.delete(group);
    }
    if (actions.groupActions.get(group) === entity) {
        actions.groupActions.delete(group);
    }
    if (action !== last) {
        const movedEntity = actions.entities[last];
        const movedGroup = actions.groups[last];
        actions.entities[action] = movedEntity;
        actions.groups[action] = movedGroup;
        actions.planIds[action] = actions.planIds[last];
        actions.sequences[action] = actions.sequences[last];
        actions.targetXs[action] = actions.targetXs[last];
        actions.targetYs[action] = actions.targetYs[last];
        actions.targetZs[action] = actions.targetZs[last];
        actions.startTicks[action] = actions.startTicks[last];
        actions.phaseStartTicks[action] =
            actions.phaseStartTicks[last];
        actions.stages[action] = actions.stages[last];
        actions.displayPhases[action] =
            actions.displayPhases[last];
        actions.acquired[action] = actions.acquired[last];
        actions.reservedCounts[action] =
            actions.reservedCounts[last];
        actions.remainingCounts[action] =
            actions.remainingCounts[last];
        actions.gatherArrivedCounts[action] =
            actions.gatherArrivedCounts[last];
        actions.observedMaximumPhases[action] =
            actions.observedMaximumPhases[last];
        actions.marks[action] = actions.marks[last];
        actions.visible[action] = actions.visible[last];
        actions.entityIndices.set(movedEntity, action);
        actions.indices.set(movedGroup, action);
        actions.groupActions.set(movedGroup, movedEntity);
    }
    actions.count = last;
}

const ACQUIRE_NONE = 0;
const ACQUIRE_READY = 1;
const ACQUIRE_PENDING_COMMIT = 2;
const DEFAULT_ARRIVAL_RADIUS = 0.15;
const SKILL_TARGET_ARRIVAL_RADIUS = 0.62;
const LAUNCH_CONTACT_START = 0.72;
