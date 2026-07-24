import {
    Update,
    Write,
    defSystem,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import { FlyingSwordSpatialService } from "../integration";
import { FlyingSwordSystemSet } from "../system-set";
import {
    FlyingSwordField,
    FlyingSwordGroupField,
    FlyingSwordMode,
    type Vector3Out,
} from "../types";
import {
    FlyingSwordRequestKind,
    FlyingSwordRequestState,
} from "./request-state";
import {
    FlyingSwordGroupStorageQuery,
    FlyingSwordStorageQuery,
} from "./queries";
import {
    FlyingSwordRuntimeState,
} from "./runtime-state";

type Groups = QueryOf<typeof FlyingSwordGroupStorageQuery>;
type Swords = QueryOf<typeof FlyingSwordStorageQuery>;

export const applyFlyingSwordRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordRequests,
    [Write(FlyingSwordRequestState), FlyingSwordGroupStorageQuery],
);

export const synchronizeFlyingSwordGroupsSystem = defSystem(
    Update.fixed,
    synchronizeFlyingSwordGroups,
    [
        TimeState,
        FlyingSwordSpatialService,
        Write(FlyingSwordRuntimeState),
        FlyingSwordGroupStorageQuery,
    ],
);

export const moveFlyingSwordsSystem = defSystem(
    Update.fixed,
    moveFlyingSwords,
    [TimeState, FlyingSwordStorageQuery],
);

export const formFlyingSwordGoalsSystem = defSystem(
    Update.fixed,
    formFlyingSwordGoals,
    [TimeState, FlyingSwordRuntimeState, FlyingSwordStorageQuery],
);

export const FlyingSwordSystemOptions = Object.freeze({
    requests: { inSet: FlyingSwordSystemSet.Request } as const,
    groups: {
        inSet: FlyingSwordSystemSet.Control,
        after: FlyingSwordSystemSet.Request,
    } as const,
    formation: {
        inSet: FlyingSwordSystemSet.Formation,
        after: FlyingSwordSystemSet.Skill,
    } as const,
    motion: {
        inSet: FlyingSwordSystemSet.Motion,
        after: FlyingSwordSystemSet.Guidance,
    } as const,
});

function applyFlyingSwordRequests(
    requests: Mut<FlyingSwordRequestState>,
    groups: Groups,
): void {
    if (requests.count === 0) return;
    const iter = groups.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        for (let row = 0; row < count; row++) {
            const group = entities[row];
            for (let request = 0; request < requests.count; request++) {
                if (requests.groups[request] !== group) continue;
                const kind = requests.kinds[request];
                if (kind === FlyingSwordRequestKind.SetMode) {
                    data[FlyingSwordGroupField.Mode][row] = requests.modes[request];
                } else if (kind === FlyingSwordRequestKind.SetTargetPoint) {
                    data[FlyingSwordGroupField.TargetX][row] = requests.xs[request];
                    data[FlyingSwordGroupField.TargetY][row] = requests.ys[request];
                    data[FlyingSwordGroupField.TargetZ][row] = requests.zs[request];
                } else if (kind === FlyingSwordRequestKind.SetCenter) {
                    data[FlyingSwordGroupField.CenterX][row] = requests.xs[request];
                    data[FlyingSwordGroupField.CenterY][row] = requests.ys[request];
                    data[FlyingSwordGroupField.CenterZ][row] = requests.zs[request];
                }
                data[FlyingSwordGroupField.Revision][row]++;
            }
        }
    }
    requests.clear();
}

const spatialPosition: Vector3Out = { x: 0, y: 0, z: 0 };

function synchronizeFlyingSwordGroups(
    time: Readonly<TimeState>,
    spatial: FlyingSwordSpatialService,
    runtime: Mut<FlyingSwordRuntimeState>,
    groups: Groups,
): void {
    const iter = groups.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const owners = data[FlyingSwordGroupField.Owner];
        const centerXs = data[FlyingSwordGroupField.CenterX];
        const centerYs = data[FlyingSwordGroupField.CenterY];
        const centerZs = data[FlyingSwordGroupField.CenterZ];
        for (let row = 0; row < count; row++) {
            if (spatial.readPosition(owners[row], spatialPosition)) {
                centerXs[row] = spatialPosition.x;
                centerYs[row] = spatialPosition.y;
                centerZs[row] = spatialPosition.z;
            }
            const snapshot = runtime.snapshot(entities[row]);
            snapshot.tick = time.tick;
            snapshot.centerX = centerXs[row];
            snapshot.centerY = centerYs[row];
            snapshot.centerZ = centerZs[row];
            snapshot.targetX = data[FlyingSwordGroupField.TargetX][row];
            snapshot.targetY = data[FlyingSwordGroupField.TargetY][row];
            snapshot.targetZ = data[FlyingSwordGroupField.TargetZ][row];
            snapshot.orbitRadius = data[FlyingSwordGroupField.OrbitRadius][row];
            snapshot.orbitHeight = data[FlyingSwordGroupField.OrbitHeight][row];
            snapshot.angularSpeed = data[FlyingSwordGroupField.AngularSpeed][row];
            snapshot.verticalAmplitude =
                data[FlyingSwordGroupField.VerticalAmplitude][row];
            snapshot.verticalSpeed = data[FlyingSwordGroupField.VerticalSpeed][row];
            snapshot.formationSize = Math.max(
                1,
                data[FlyingSwordGroupField.FormationSize][row],
            );
            snapshot.mode = data[FlyingSwordGroupField.Mode][row] as FlyingSwordMode;
        }
    }
    runtime.removeStale(time.tick);
}

function formFlyingSwordGoals(
    time: Readonly<TimeState>,
    runtime: Readonly<FlyingSwordRuntimeState>,
    swords: Swords,
): void {
    const iter = swords.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        const groups = data[FlyingSwordField.Group];
        const slots = data[FlyingSwordField.Slot];
        const formationGoalXs = data[FlyingSwordField.FormationGoalX];
        const formationGoalYs = data[FlyingSwordField.FormationGoalY];
        const formationGoalZs = data[FlyingSwordField.FormationGoalZ];
        const goalXs = data[FlyingSwordField.GoalX];
        const goalYs = data[FlyingSwordField.GoalY];
        const goalZs = data[FlyingSwordField.GoalZ];
        const arrivalRadii = data[FlyingSwordField.ArrivalRadius];
        const speedMultipliers = data[FlyingSwordField.SpeedMultiplier];
        const accelerationMultipliers =
            data[FlyingSwordField.AccelerationMultiplier];
        const contactActive = data[FlyingSwordField.ContactActive];
        for (let row = 0; row < count; row++) {
            const snapshot = runtime.groups.get(groups[row]);
            if (!snapshot || snapshot.tick !== time.tick) continue;

            const slot = slots[row];
            const phase = time.elapsed * snapshot.angularSpeed +
                slot * Math.PI * 2 / snapshot.formationSize;
            let radius = snapshot.orbitRadius;
            let centerX = snapshot.centerX;
            let centerY = snapshot.centerY;
            let centerZ = snapshot.centerZ;
            let height = snapshot.orbitHeight;
            let verticalAmplitude = snapshot.verticalAmplitude;

            if (snapshot.mode === FlyingSwordMode.Focus) {
                centerX = snapshot.targetX;
                centerY = snapshot.targetY;
                centerZ = snapshot.targetZ;
                radius *= 0.28;
                height *= 0.72;
                verticalAmplitude *= 0.65;
            } else if (snapshot.mode === FlyingSwordMode.Recall) {
                radius = Math.min(radius, 0.85);
                height *= 0.55;
                verticalAmplitude *= 0.25;
            }

            const slotPhase = slot * Math.PI * 2 / snapshot.formationSize;
            const verticalPhase =
                time.elapsed * snapshot.verticalSpeed + slotPhase;
            const heightWave = Math.sin(verticalPhase) +
                Math.sin(verticalPhase * 0.5 + phase) * 0.25;
            const goalX = centerX + Math.cos(phase) * radius;
            const goalY =
                centerY + height + heightWave * verticalAmplitude;
            const goalZ = centerZ + Math.sin(phase) * radius;
            formationGoalXs[row] = goalX;
            formationGoalYs[row] = goalY;
            formationGoalZs[row] = goalZ;
            goalXs[row] = goalX;
            goalYs[row] = goalY;
            goalZs[row] = goalZ;
            arrivalRadii[row] = DEFAULT_ARRIVAL_RADIUS;
            speedMultipliers[row] = 1;
            accelerationMultipliers[row] = 1;
            contactActive[row] = 0;
        }
    }
}

function moveFlyingSwords(
    time: Readonly<TimeState>,
    swords: Swords,
): void {
    const iter = swords.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        const previousXs = data[FlyingSwordField.PreviousX];
        const previousYs = data[FlyingSwordField.PreviousY];
        const previousZs = data[FlyingSwordField.PreviousZ];
        const xs = data[FlyingSwordField.X];
        const ys = data[FlyingSwordField.Y];
        const zs = data[FlyingSwordField.Z];
        const goalXs = data[FlyingSwordField.GoalX];
        const goalYs = data[FlyingSwordField.GoalY];
        const goalZs = data[FlyingSwordField.GoalZ];
        const velocityXs = data[FlyingSwordField.VelocityX];
        const velocityYs = data[FlyingSwordField.VelocityY];
        const velocityZs = data[FlyingSwordField.VelocityZ];
        const maximumSpeeds = data[FlyingSwordField.MaximumSpeed];
        const accelerations = data[FlyingSwordField.Acceleration];
        const speedMultipliers = data[FlyingSwordField.SpeedMultiplier];
        const accelerationMultipliers =
            data[FlyingSwordField.AccelerationMultiplier];
        const forwardXs = data[FlyingSwordField.ForwardX];
        const forwardYs = data[FlyingSwordField.ForwardY];
        const forwardZs = data[FlyingSwordField.ForwardZ];
        for (let row = 0; row < count; row++) {
            const x = xs[row];
            const y = ys[row];
            const z = zs[row];
            previousXs[row] = x;
            previousYs[row] = y;
            previousZs[row] = z;

            const dx = goalXs[row] - x;
            const dy = goalYs[row] - y;
            const dz = goalZs[row] - z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const maximumSpeed =
                maximumSpeeds[row] * speedMultipliers[row];
            const desiredSpeed = Math.min(maximumSpeed, distance * 6);
            const inverseDistance = distance > 1e-6 ? 1 / distance : 0;
            const desiredVelocityX = dx * inverseDistance * desiredSpeed;
            const desiredVelocityY = dy * inverseDistance * desiredSpeed;
            const desiredVelocityZ = dz * inverseDistance * desiredSpeed;

            let changeX = desiredVelocityX - velocityXs[row];
            let changeY = desiredVelocityY - velocityYs[row];
            let changeZ = desiredVelocityZ - velocityZs[row];
            const changeLength = Math.sqrt(
                changeX * changeX +
                changeY * changeY +
                changeZ * changeZ,
            );
            const maximumChange =
                accelerations[row] *
                accelerationMultipliers[row] *
                time.delta;
            if (changeLength > maximumChange && changeLength > 1e-6) {
                const scale = maximumChange / changeLength;
                changeX *= scale;
                changeY *= scale;
                changeZ *= scale;
            }

            const velocityX = velocityXs[row] + changeX;
            const velocityY = velocityYs[row] + changeY;
            const velocityZ = velocityZs[row] + changeZ;
            velocityXs[row] = velocityX;
            velocityYs[row] = velocityY;
            velocityZs[row] = velocityZ;
            xs[row] = x + velocityX * time.delta;
            ys[row] = y + velocityY * time.delta;
            zs[row] = z + velocityZ * time.delta;

            const velocityLength = Math.sqrt(
                velocityX * velocityX +
                velocityY * velocityY +
                velocityZ * velocityZ,
            );
            if (velocityLength > 1e-4) {
                const inverseVelocity = 1 / velocityLength;
                forwardXs[row] = velocityX * inverseVelocity;
                forwardYs[row] = velocityY * inverseVelocity;
                forwardZs[row] = velocityZ * inverseVelocity;
            }
        }
    }
}

const DEFAULT_ARRIVAL_RADIUS = 0.15;
