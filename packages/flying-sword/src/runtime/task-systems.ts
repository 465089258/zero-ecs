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
} from "@zero-ecs/math/3d";
import {
    MotionSystemSet,
    MoveTowards3,
} from "@zero-ecs/motion/3d";
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
    const requestedCancellationIter = cancelGroups.iter();
    while (requestedCancellationIter.next()) {
        const [count, , data] = requestedCancellationIter.current;
        const groups = data[CancelFlyingSwordGroupTasksRequest.Group];
        for (let row = 0; row < count; row++) {
            cancellations.groups.add(groups[row] as Entity);
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
        for (let request = 0; request < requestCount; request++) {
            cancelGroupTasks(
                commands,
                tick,
                requestedGroups[request],
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
    tasks: Tasks,
): void {
    const tick = time.tick;
    const iter = tasks.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            ,
            flights,
            positions,
            formationGoals,
            motion,
            taskData,
            contact,
        ] = iter.current;
        const maximumSpeeds =
            flights[FlyingSwordFlight.MaximumSpeed];
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
            const phase = phases[row];
            if (phase === FlyingSwordTaskPhase.Rise) {
                motionTargetXs[row] =
                    startXs[row] +
                    (targetXs[row] - startXs[row]) *
                    RISE_FORWARD_FRACTION;
                motionTargetYs[row] =
                    Math.max(startYs[row], targetYs[row]) +
                    RISE_HEIGHT;
                motionTargetZs[row] =
                    startZs[row] +
                    (targetZs[row] - startZs[row]) *
                    RISE_FORWARD_FRACTION;
                motionMaximumSpeeds[row] =
                    maximumSpeeds[row] * RISE_SPEED_MULTIPLIER;
                motionAccelerations[row] =
                    accelerations[row] * RISE_ACCELERATION_MULTIPLIER;
                arrivalRadii[row] = TASK_ARRIVAL_RADIUS;
                if (tick - phaseStartTicks[row] >= RISE_TICKS) {
                    phases[row] = FlyingSwordTaskPhase.Dive;
                    phaseStartTicks[row] = tick;
                    startXs[row] = xs[row];
                    startYs[row] = ys[row];
                    startZs[row] = zs[row];
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
                motionTargetXs[row] = targetXs[row];
                motionTargetYs[row] = targetYs[row];
                motionTargetZs[row] = targetZs[row];
                motionMaximumSpeeds[row] =
                    maximumSpeeds[row] * DIVE_SPEED_MULTIPLIER;
                motionAccelerations[row] =
                    accelerations[row] * DIVE_ACCELERATION_MULTIPLIER;
                arrivalRadii[row] = DIVE_ARRIVAL_RADIUS;
                const dx = targetXs[row] - xs[row];
                const dy = targetYs[row] - ys[row];
                const dz = targetZs[row] - zs[row];
                if (
                    tick - phaseStartTicks[row] >= DIVE_MAXIMUM_TICKS ||
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

            motionTargetXs[row] = formationXs[row];
            motionTargetYs[row] = formationYs[row];
            motionTargetZs[row] = formationZs[row];
            motionMaximumSpeeds[row] =
                maximumSpeeds[row] * RETURN_SPEED_MULTIPLIER;
            motionAccelerations[row] =
                accelerations[row] * RETURN_ACCELERATION_MULTIPLIER;
            arrivalRadii[row] = RETURN_ARRIVAL_RADIUS;
            const dx = formationXs[row] - xs[row];
            const dy = formationYs[row] - ys[row];
            const dz = formationZs[row] - zs[row];
            if (
                dx * dx + dy * dy + dz * dz <=
                    RETURN_ARRIVAL_RADIUS * RETURN_ARRIVAL_RADIUS ||
                tick - phaseStartTicks[row] >= RETURN_MAXIMUM_TICKS
            ) {
                const command = commands
                    .entity(entities[row])
                    .remove(FlyingSwordTaskStorage);
                if (hasContactWindow) {
                    command.remove(FlyingSwordContactWindowStorage);
                }
                command.submit();
            }
        }
    }
}

const RISE_TICKS = 14;
const RISE_HEIGHT = 3.8;
const RISE_FORWARD_FRACTION = 0.3;
const RISE_SPEED_MULTIPLIER = 1.2;
const RISE_ACCELERATION_MULTIPLIER = 1.25;
const DIVE_SPEED_MULTIPLIER = 2.15;
const DIVE_ACCELERATION_MULTIPLIER = 1.8;
const DIVE_MAXIMUM_TICKS = 30;
const DIVE_ARRIVAL_RADIUS = 0.28;
const RETURN_SPEED_MULTIPLIER = 1.35;
const RETURN_ACCELERATION_MULTIPLIER = 1.3;
const RETURN_ARRIVAL_RADIUS = 0.32;
const RETURN_MAXIMUM_TICKS = 120;
const TASK_ARRIVAL_RADIUS = 0.12;
