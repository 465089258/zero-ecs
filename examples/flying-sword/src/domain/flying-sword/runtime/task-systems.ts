/** 飞剑示例本地领域运行时。 */
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
import {
    Float3,
    Position3Type,
} from "../../../infrastructure/math";
import {
    MotionSystemSet,
    MoveTowards3,
} from "../../../infrastructure/motion";
import { FlyingSwordSystemSet } from "../system-set";
import {
    FlyingSwordFlight,
    FlyingSwordMember,
    FlyingSwordTask,
    FlyingSwordTaskPhase,
} from "../types";
import {
    ActiveFlyingSwordTaskStorageQuery,
    CancelFlyingSwordGroupTasksRequestStorageQuery,
    FinishFlyingSwordTaskRequestStorageQuery,
    FlyingSwordTaskStorageQuery,
    StartFlyingSwordTaskRequestStorageQuery,
} from "./queries";
import {
    CancelFlyingSwordGroupTasksRequest,
    FinishFlyingSwordTaskRequest,
    FlyingSwordContactWindowStorage,
    FlyingSwordMemberStorage,
    FlyingSwordSkillActionStorage,
    FlyingSwordTaskStorage,
    StartFlyingSwordTaskRequest,
} from "./storage";
import { FlyingSwordTaskCancellationState } from "./task-state";

type StartRequests =
    QueryOf<typeof StartFlyingSwordTaskRequestStorageQuery>;
type FinishRequests =
    QueryOf<typeof FinishFlyingSwordTaskRequestStorageQuery>;
type CancelGroupRequests =
    QueryOf<typeof CancelFlyingSwordGroupTasksRequestStorageQuery>;
type Tasks = QueryOf<typeof FlyingSwordTaskStorageQuery>;
type ActiveTasks = QueryOf<typeof ActiveFlyingSwordTaskStorageQuery>;

export const applyFlyingSwordTaskRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordTaskRequests,
    [
        Commands,
        TimeState,
        World,
        Write(FlyingSwordTaskCancellationState),
        StartFlyingSwordTaskRequestStorageQuery,
        FinishFlyingSwordTaskRequestStorageQuery,
        CancelFlyingSwordGroupTasksRequestStorageQuery,
        ActiveFlyingSwordTaskStorageQuery,
    ],
);

export const guideFlyingSwordTasksSystem = defSystem(
    Update.fixed,
    guideFlyingSwordTasks,
    [
        Commands,
        TimeState,
        FlyingSwordTaskCancellationState,
        FlyingSwordTaskStorageQuery,
    ],
);

export const FlyingSwordTaskSystemOptions = Object.freeze({
    requests: {
        inSet: FlyingSwordSystemSet.Request,
    } as const,
    guidance: {
        inSet: FlyingSwordSystemSet.Guidance,
        after: FlyingSwordSystemSet.Formation,
        before: MotionSystemSet.Integrate3,
    } as const,
});

function applyFlyingSwordTaskRequests(
    commands: Commands,
    time: Readonly<TimeState>,
    world: World,
    cancellations: Mut<FlyingSwordTaskCancellationState>,
    starts: StartRequests,
    finishes: FinishRequests,
    cancelGroups: CancelGroupRequests,
    tasks: ActiveTasks,
): void {
    const tick = time.tick;
    cancellations.groups.clear();
    cancellations.immediateGroups.clear();
    const requestedCancellationIter = cancelGroups.iter();
    while (requestedCancellationIter.next()) {
        const [count, , data] = requestedCancellationIter.current;
        const groups = data[CancelFlyingSwordGroupTasksRequest.Group];
        const immediate =
            data[CancelFlyingSwordGroupTasksRequest.Immediate];
        for (let row = 0; row < count; row++) {
            const group = groups[row] as Entity;
            cancellations.groups.add(group);
            if (immediate[row] !== 0) {
                cancellations.immediateGroups.add(group);
            }
        }
    }
    const startIter = starts.iter();
    while (startIter.next()) {
        const [count, entities, data] = startIter.current;
        const swords = data[StartFlyingSwordTaskRequest.Sword];
        const targetXs = data[StartFlyingSwordTaskRequest.TargetX];
        const targetYs = data[StartFlyingSwordTaskRequest.TargetY];
        const targetZs = data[StartFlyingSwordTaskRequest.TargetZ];
        for (let row = 0; row < count; row++) {
            const sword = swords[row];
            const group = world.get(
                sword,
                FlyingSwordMemberStorage,
                FlyingSwordMember.Group,
            );
            if (
                group !== null &&
                !cancellations.groups.has(group as Entity) &&
                world.has(sword, FlyingSwordMemberStorage) &&
                world.has(sword, Position3Type) &&
                !world.has(sword, FlyingSwordSkillActionStorage)
            ) {
                const x = world.get(sword, Position3Type, Float3.X) ?? 0;
                const y = world.get(sword, Position3Type, Float3.Y) ?? 0;
                const z = world.get(sword, Position3Type, Float3.Z) ?? 0;
                const command = commands.entity(sword);
                if (!world.has(sword, FlyingSwordTaskStorage)) {
                    command.add(FlyingSwordTaskStorage);
                }
                if (world.has(sword, FlyingSwordContactWindowStorage)) {
                    command.remove(FlyingSwordContactWindowStorage);
                }
                command
                    .set(
                        FlyingSwordTaskStorage,
                        FlyingSwordTask.Phase,
                        FlyingSwordTaskPhase.Rise,
                    )
                    .set(
                        FlyingSwordTaskStorage,
                        FlyingSwordTask.PhaseStartTick,
                        tick,
                    )
                    .set(
                        FlyingSwordTaskStorage,
                        FlyingSwordTask.StartX,
                        x,
                    )
                    .set(
                        FlyingSwordTaskStorage,
                        FlyingSwordTask.StartY,
                        y,
                    )
                    .set(
                        FlyingSwordTaskStorage,
                        FlyingSwordTask.StartZ,
                        z,
                    )
                    .set(
                        FlyingSwordTaskStorage,
                        FlyingSwordTask.TargetX,
                        targetXs[row],
                    )
                    .set(
                        FlyingSwordTaskStorage,
                        FlyingSwordTask.TargetY,
                        targetYs[row],
                    )
                    .set(
                        FlyingSwordTaskStorage,
                        FlyingSwordTask.TargetZ,
                        targetZs[row],
                    )
                    .submit();
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }

    const finishIter = finishes.iter();
    while (finishIter.next()) {
        const [count, entities, data] = finishIter.current;
        const swords = data[FinishFlyingSwordTaskRequest.Sword];
        for (let row = 0; row < count; row++) {
            const sword = swords[row];
            if (world.has(sword, FlyingSwordTaskStorage)) {
                world.set(
                    sword,
                    FlyingSwordTaskStorage,
                    FlyingSwordTask.Phase,
                    FlyingSwordTaskPhase.Return,
                );
                world.set(
                    sword,
                    FlyingSwordTaskStorage,
                    FlyingSwordTask.PhaseStartTick,
                    tick,
                );
                if (world.has(sword, FlyingSwordContactWindowStorage)) {
                    commands
                        .entity(sword)
                        .remove(FlyingSwordContactWindowStorage)
                        .submit();
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }

    const cancelIter = cancelGroups.iter();
    while (cancelIter.next()) {
        const [requestCount, requestEntities, requests] =
            cancelIter.current;
        const requestedGroups =
            requests[CancelFlyingSwordGroupTasksRequest.Group];
        const immediate =
            requests[CancelFlyingSwordGroupTasksRequest.Immediate];
        for (let request = 0; request < requestCount; request++) {
            cancelGroupTasks(
                commands,
                tick,
                requestedGroups[request],
                immediate[request] !== 0,
                tasks,
            );
            commands
                .entity(requestEntities[request])
                .despawn()
                .submit();
        }
    }
}

function cancelGroupTasks(
    commands: Commands,
    tick: number,
    group: Entity,
    immediate: boolean,
    tasks: ActiveTasks,
): void {
    const iter = tasks.iter();
    while (iter.next()) {
        const [count, entities, members, taskData, , , , contact] =
            iter.current;
        const groups = members[FlyingSwordMember.Group];
        const phases = taskData[FlyingSwordTask.Phase];
        const phaseStartTicks =
            taskData[FlyingSwordTask.PhaseStartTick];
        for (let row = 0; row < count; row++) {
            if (groups[row] !== group) continue;
            if (immediate) {
                const command = commands
                    .entity(entities[row])
                    .remove(FlyingSwordTaskStorage);
                if (contact) {
                    command.remove(FlyingSwordContactWindowStorage);
                }
                command.submit();
                continue;
            }
            phases[row] = FlyingSwordTaskPhase.Return;
            phaseStartTicks[row] = tick;
            if (contact) {
                commands
                    .entity(entities[row])
                    .remove(FlyingSwordContactWindowStorage)
                    .submit();
            }
        }
    }
}

function guideFlyingSwordTasks(
    commands: Commands,
    time: Readonly<TimeState>,
    cancellations: Readonly<FlyingSwordTaskCancellationState>,
    tasks: Tasks,
): void {
    const tick = time.tick;
    const iter = tasks.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            flights,
            positions,
            formationGoals,
            motion,
            taskData,
            contact,
        ] = iter.current;
        const maximumSpeeds =
            flights[FlyingSwordFlight.MaximumSpeed];
        const groups = members[FlyingSwordMember.Group];
        const slots = members[FlyingSwordMember.Slot];
        const accelerations =
            flights[FlyingSwordFlight.Acceleration];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const formationXs = formationGoals[Float3.X];
        const formationYs = formationGoals[Float3.Y];
        const formationZs = formationGoals[Float3.Z];
        const motionTargetXs = motion[MoveTowards3.TargetX];
        const motionTargetYs = motion[MoveTowards3.TargetY];
        const motionTargetZs = motion[MoveTowards3.TargetZ];
        const motionMaximumSpeeds =
            motion[MoveTowards3.MaximumSpeed];
        const motionAccelerations =
            motion[MoveTowards3.Acceleration];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];
        const phases = taskData[FlyingSwordTask.Phase];
        const phaseStartTicks =
            taskData[FlyingSwordTask.PhaseStartTick];
        const startXs = taskData[FlyingSwordTask.StartX];
        const startYs = taskData[FlyingSwordTask.StartY];
        const startZs = taskData[FlyingSwordTask.StartZ];
        const targetXs = taskData[FlyingSwordTask.TargetX];
        const targetYs = taskData[FlyingSwordTask.TargetY];
        const targetZs = taskData[FlyingSwordTask.TargetZ];
        const hasContactWindow = contact !== undefined;

        for (let row = 0; row < count; row++) {
            if (
                cancellations.immediateGroups.has(
                    groups[row] as Entity,
                )
            ) {
                continue;
            }
            const phase = phases[row];
            if (phase === FlyingSwordTaskPhase.Return) {
                const returnTick = tick - phaseStartTicks[row];
                const returnProgress = Math.min(
                    1,
                    returnTick / RETURN_CURVE_TICKS,
                );
                writeTaskReturnTarget(
                    xs[row],
                    ys[row],
                    zs[row],
                    formationXs[row],
                    formationYs[row],
                    formationZs[row],
                    slots[row],
                    returnProgress,
                    motionTargetXs,
                    motionTargetYs,
                    motionTargetZs,
                    row,
                );
                motionMaximumSpeeds[row] =
                    maximumSpeeds[row] * RETURN_SPEED_MULTIPLIER;
                motionAccelerations[row] =
                    accelerations[row] *
                    RETURN_ACCELERATION_MULTIPLIER;
                arrivalRadii[row] = RETURN_ARRIVAL_RADIUS;
                const dx = formationXs[row] - xs[row];
                const dy = formationYs[row] - ys[row];
                const dz = formationZs[row] - zs[row];
                if (
                    dx * dx + dy * dy + dz * dz <=
                        RETURN_ARRIVAL_RADIUS *
                        RETURN_ARRIVAL_RADIUS ||
                    returnTick >= RETURN_MAXIMUM_TICKS
                ) {
                    const command = commands
                        .entity(entities[row])
                        .remove(FlyingSwordTaskStorage);
                    if (hasContactWindow) {
                        command.remove(
                            FlyingSwordContactWindowStorage,
                        );
                    }
                    command.submit();
                }
                continue;
            }
            const targetDeltaX = targetXs[row] - startXs[row];
            const targetDeltaZ = targetZs[row] - startZs[row];
            const targetDistance = Math.sqrt(
                targetDeltaX * targetDeltaX +
                targetDeltaZ * targetDeltaZ,
            );
            const curveScale = resolveTaskCurveScale(targetDistance);
            const curveTicks = Math.max(
                1,
                Math.round(TASK_CURVE_TICKS * curveScale),
            );
            const riseTicks = Math.max(
                TASK_CURVE_MINIMUM_RISE_TICKS,
                Math.round(RISE_TICKS * curveScale),
            );
            const lookaheadTicks = Math.max(
                TASK_CURVE_MINIMUM_LOOKAHEAD_TICKS,
                Math.round(
                    TASK_CURVE_LOOKAHEAD_TICKS * curveScale,
                ),
            );
            const diveMaximumTicks = Math.max(
                TASK_CURVE_MINIMUM_DIVE_TICKS,
                curveTicks - riseTicks + TASK_CURVE_DIVE_GRACE_TICKS,
            );
            if (phase === FlyingSwordTaskPhase.Rise) {
                const phaseTick = tick - phaseStartTicks[row];
                const riseEndProgress =
                    (riseTicks + lookaheadTicks) / curveTicks;
                const progress = Math.min(
                    riseEndProgress,
                    (phaseTick + lookaheadTicks) / curveTicks,
                );
                writeTaskCurveTarget(
                    startXs[row],
                    startYs[row],
                    startZs[row],
                    targetXs[row],
                    targetYs[row],
                    targetZs[row],
                    progress,
                    slots[row],
                    curveScale,
                    motionTargetXs,
                    motionTargetYs,
                    motionTargetZs,
                    row,
                );
                const speedProgress = smoothStep(progress);
                motionMaximumSpeeds[row] =
                    maximumSpeeds[row] * (
                        RISE_SPEED_MULTIPLIER +
                        (
                            DIVE_SPEED_MULTIPLIER -
                            RISE_SPEED_MULTIPLIER
                        ) * speedProgress
                    );
                motionAccelerations[row] =
                    accelerations[row] * (
                        RISE_ACCELERATION_MULTIPLIER +
                        (
                            DIVE_ACCELERATION_MULTIPLIER -
                            RISE_ACCELERATION_MULTIPLIER
                        ) * speedProgress
                    );
                arrivalRadii[row] = TASK_ARRIVAL_RADIUS;
                if (phaseTick >= riseTicks) {
                    phases[row] = FlyingSwordTaskPhase.Dive;
                    phaseStartTicks[row] = tick;
                    if (!hasContactWindow) {
                        commands
                            .entity(entities[row])
                            .add(FlyingSwordContactWindowStorage)
                            .submit();
                    }
                }
                continue;
            }

            if (phase === FlyingSwordTaskPhase.Dive) {
                const phaseTick = tick - phaseStartTicks[row];
                const progress = Math.min(
                    1,
                    (
                        riseTicks +
                        phaseTick +
                        lookaheadTicks
                    ) / curveTicks,
                );
                writeTaskCurveTarget(
                    startXs[row],
                    startYs[row],
                    startZs[row],
                    targetXs[row],
                    targetYs[row],
                    targetZs[row],
                    progress,
                    slots[row],
                    curveScale,
                    motionTargetXs,
                    motionTargetYs,
                    motionTargetZs,
                    row,
                );
                const speedProgress = smoothStep(progress);
                motionMaximumSpeeds[row] =
                    maximumSpeeds[row] * (
                        RISE_SPEED_MULTIPLIER +
                        (
                            DIVE_SPEED_MULTIPLIER -
                            RISE_SPEED_MULTIPLIER
                        ) * speedProgress
                    );
                motionAccelerations[row] =
                    accelerations[row] * (
                        RISE_ACCELERATION_MULTIPLIER +
                        (
                            DIVE_ACCELERATION_MULTIPLIER -
                            RISE_ACCELERATION_MULTIPLIER
                        ) * speedProgress
                    );
                arrivalRadii[row] = DIVE_ARRIVAL_RADIUS;
                const dx = targetXs[row] - xs[row];
                const dy = targetYs[row] - ys[row];
                const dz = targetZs[row] - zs[row];
                if (
                    phaseTick >= diveMaximumTicks ||
                    dx * dx + dy * dy + dz * dz <=
                        DIVE_ARRIVAL_RADIUS * DIVE_ARRIVAL_RADIUS
                ) {
                    phases[row] = FlyingSwordTaskPhase.Return;
                    phaseStartTicks[row] = tick;
                    if (hasContactWindow) {
                        commands
                            .entity(entities[row])
                            .remove(FlyingSwordContactWindowStorage)
                            .submit();
                    }
                }
                continue;
            }
        }
    }
}

function writeTaskCurveTarget(
    startX: number,
    startY: number,
    startZ: number,
    targetX: number,
    targetY: number,
    targetZ: number,
    progress: number,
    slot: number,
    curveScale: number,
    outXs: Float32Array,
    outYs: Float32Array,
    outZs: Float32Array,
    row: number,
): void {
    const deltaX = targetX - startX;
    const deltaZ = targetZ - startZ;
    const horizontalLength = Math.sqrt(
        deltaX * deltaX + deltaZ * deltaZ,
    );
    const inverseLength =
        horizontalLength > TASK_DIRECTION_EPSILON
            ? 1 / horizontalLength
            : 0;
    const directionX = deltaX * inverseLength;
    const directionZ = deltaZ * inverseLength;
    const sideX = -directionZ;
    const sideZ = directionX;
    const sideSign = (slot & 1) === 0 ? 1 : -1;
    const heightScale = Math.sqrt(curveScale);
    const lane = (
        1 + slot % TASK_CURVE_LANE_COUNT *
        TASK_CURVE_LANE_STEP
    ) * curveScale;
    const lateral = sideSign * lane;
    const forwardControl = Math.min(
        TASK_CURVE_FORWARD_CONTROL * curveScale,
        horizontalLength * TASK_CURVE_FORWARD_DISTANCE_RATIO,
    );
    const approachDistance = Math.min(
        TASK_CURVE_APPROACH_DISTANCE * curveScale,
        horizontalLength * TASK_CURVE_APPROACH_DISTANCE_RATIO,
    );
    const maximumY = Math.max(startY, targetY);
    const firstControlX =
        startX +
        directionX * forwardControl +
        sideX * lateral;
    const firstControlY =
        maximumY + TASK_CURVE_FIRST_HEIGHT * heightScale;
    const firstControlZ =
        startZ +
        directionZ * forwardControl +
        sideZ * lateral;
    const secondControlX =
        targetX -
        directionX * approachDistance -
        sideX * lateral * TASK_CURVE_APPROACH_SWING;
    const secondControlY =
        maximumY + TASK_CURVE_SECOND_HEIGHT * heightScale;
    const secondControlZ =
        targetZ -
        directionZ * approachDistance -
        sideZ * lateral * TASK_CURVE_APPROACH_SWING;
    const inverse = 1 - progress;
    const startWeight = inverse * inverse * inverse;
    const firstWeight = 3 * inverse * inverse * progress;
    const secondWeight = 3 * inverse * progress * progress;
    const targetWeight = progress * progress * progress;
    outXs[row] =
        startWeight * startX +
        firstWeight * firstControlX +
        secondWeight * secondControlX +
        targetWeight * targetX;
    outYs[row] =
        startWeight * startY +
        firstWeight * firstControlY +
        secondWeight * secondControlY +
        targetWeight * targetY;
    outZs[row] =
        startWeight * startZ +
        firstWeight * firstControlZ +
        secondWeight * secondControlZ +
        targetWeight * targetZ;
}

function writeTaskReturnTarget(
    x: number,
    y: number,
    z: number,
    formationX: number,
    formationY: number,
    formationZ: number,
    slot: number,
    progress: number,
    outXs: Float32Array,
    outYs: Float32Array,
    outZs: Float32Array,
    row: number,
): void {
    const dx = formationX - x;
    const dz = formationZ - z;
    const horizontalLength = Math.sqrt(dx * dx + dz * dz);
    const inverseLength = horizontalLength > TASK_DIRECTION_EPSILON
        ? 1 / horizontalLength
        : 0;
    const directionX = dx * inverseLength;
    const directionZ = dz * inverseLength;
    const sideSign = (slot & 1) === 0 ? 1 : -1;
    const lateral =
        sideSign * RETURN_CURVE_LATERAL * (1 - progress);
    const controlX =
        (x + formationX) * 0.5 - directionZ * lateral;
    const controlY =
        Math.max(y, formationY) +
        RETURN_CURVE_HEIGHT * (1 - progress);
    const controlZ =
        (z + formationZ) * 0.5 + directionX * lateral;
    const t = RETURN_CURVE_LOOKAHEAD;
    const inverse = 1 - t;
    outXs[row] =
        inverse * inverse * x +
        2 * inverse * t * controlX +
        t * t * formationX;
    outYs[row] =
        inverse * inverse * y +
        2 * inverse * t * controlY +
        t * t * formationY;
    outZs[row] =
        inverse * inverse * z +
        2 * inverse * t * controlZ +
        t * t * formationZ;
}

function smoothStep(value: number): number {
    const clamped = Math.max(0, Math.min(1, value));
    return clamped * clamped * (3 - 2 * clamped);
}

function resolveTaskCurveScale(targetDistance: number): number {
    return Math.max(
        TASK_CURVE_MINIMUM_SCALE,
        Math.min(
            TASK_CURVE_MAXIMUM_SCALE,
            targetDistance / TASK_CURVE_REFERENCE_DISTANCE,
        ),
    );
}

const RISE_TICKS = 10;
const TASK_CURVE_TICKS = 30;
const TASK_CURVE_LOOKAHEAD_TICKS = 5;
const TASK_CURVE_REFERENCE_DISTANCE = 8;
const TASK_CURVE_MINIMUM_SCALE = 0.45;
const TASK_CURVE_MAXIMUM_SCALE = 1.35;
const TASK_CURVE_MINIMUM_RISE_TICKS = 4;
const TASK_CURVE_MINIMUM_LOOKAHEAD_TICKS = 2;
const TASK_CURVE_MINIMUM_DIVE_TICKS = 10;
const TASK_CURVE_DIVE_GRACE_TICKS = 4;
const TASK_CURVE_FORWARD_CONTROL = 1.4;
const TASK_CURVE_FORWARD_DISTANCE_RATIO = 0.3;
const TASK_CURVE_APPROACH_DISTANCE = 2.2;
const TASK_CURVE_APPROACH_DISTANCE_RATIO = 0.34;
const TASK_CURVE_FIRST_HEIGHT = 2.35;
const TASK_CURVE_SECOND_HEIGHT = 1.55;
const TASK_CURVE_LANE_COUNT = 3;
const TASK_CURVE_LANE_STEP = 0.28;
const TASK_CURVE_APPROACH_SWING = 0.45;
const TASK_DIRECTION_EPSILON = 1e-6;
const RISE_SPEED_MULTIPLIER = 1.55;
const RISE_ACCELERATION_MULTIPLIER = 1.35;
const DIVE_SPEED_MULTIPLIER = 2.2;
const DIVE_ACCELERATION_MULTIPLIER = 1.8;
const DIVE_ARRIVAL_RADIUS = 0.28;
const RETURN_CURVE_TICKS = 34;
const RETURN_CURVE_LOOKAHEAD = 0.34;
const RETURN_CURVE_LATERAL = 1.35;
const RETURN_CURVE_HEIGHT = 0.9;
const RETURN_SPEED_MULTIPLIER = 1.9;
const RETURN_ACCELERATION_MULTIPLIER = 1.4;
const RETURN_ARRIVAL_RADIUS = 0.28;
const RETURN_MAXIMUM_TICKS = 64;
const TASK_ARRIVAL_RADIUS = 0.08;
