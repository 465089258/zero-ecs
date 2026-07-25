import {
    Commands,
    Update,
    World,
    Write,
    defSystem,
    type ComponentColumns,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    Direction3Type,
    Float3,
} from "@zero-ecs/math/3d";
import { MotionSystemSet } from "@zero-ecs/motion/3d";
import { FlyingSwordSystemSet } from "../system-set";
import {
    FlyingSwordControl,
    FlyingSwordFormation,
    FlyingSwordGroup,
    FlyingSwordMember,
    FlyingSwordMode,
} from "../types";
import { FlyingSwordEntityAccessState } from "./access-state";
import {
    FlyingSwordBaseStorageQuery,
    FlyingSwordGroupStorageQuery,
    FlyingSwordOrientationStorageQuery,
    FocusFlyingSwordRequestStorageQuery,
    SetFlyingSwordCenterRequestStorageQuery,
    SetFlyingSwordModeRequestStorageQuery,
} from "./queries";
import { FlyingSwordGroupIndexState } from "./runtime-state";
import {
    FlyingSwordControlStorage,
    FlyingSwordFormationStorage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupTarget3Storage,
    FocusFlyingSwordRequest,
    SetFlyingSwordCenterRequest,
    SetFlyingSwordModeRequest,
} from "./storage";

type Groups = QueryOf<typeof FlyingSwordGroupStorageQuery>;
type Swords = QueryOf<typeof FlyingSwordBaseStorageQuery>;
type CenterRequests =
    QueryOf<typeof SetFlyingSwordCenterRequestStorageQuery>;
type FocusRequests =
    QueryOf<typeof FocusFlyingSwordRequestStorageQuery>;
type ModeRequests =
    QueryOf<typeof SetFlyingSwordModeRequestStorageQuery>;
type OrientedSwords =
    QueryOf<typeof FlyingSwordOrientationStorageQuery>;

export const applyFlyingSwordCenterRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordCenterRequests,
    [
        Commands,
        World,
        Write(FlyingSwordEntityAccessState),
        SetFlyingSwordCenterRequestStorageQuery,
    ],
);

export const applyFlyingSwordFocusRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordFocusRequests,
    [
        Commands,
        World,
        Write(FlyingSwordEntityAccessState),
        FocusFlyingSwordRequestStorageQuery,
    ],
);

export const applyFlyingSwordModeRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordModeRequests,
    [
        Commands,
        World,
        Write(FlyingSwordEntityAccessState),
        SetFlyingSwordModeRequestStorageQuery,
    ],
);

export const snapshotFlyingSwordGroupsSystem = defSystem(
    Update.fixed,
    snapshotFlyingSwordGroups,
    [
        TimeState,
        World,
        Write(FlyingSwordEntityAccessState),
        Write(FlyingSwordGroupIndexState),
        FlyingSwordGroupStorageQuery,
    ],
);

export const formFlyingSwordGoalsSystem = defSystem(
    Update.fixed,
    formFlyingSwordGoals,
    [TimeState, FlyingSwordGroupIndexState, FlyingSwordBaseStorageQuery],
);

export const orientIdleFlyingSwordsSystem = defSystem(
    Update.fixed,
    orientIdleFlyingSwords,
    [FlyingSwordGroupIndexState, FlyingSwordOrientationStorageQuery],
);

export const FlyingSwordSystemOptions = Object.freeze({
    centerRequests: { inSet: FlyingSwordSystemSet.Request } as const,
    focusRequests: { inSet: FlyingSwordSystemSet.Request } as const,
    modeRequests: { inSet: FlyingSwordSystemSet.Request } as const,
    groups: {
        inSet: FlyingSwordSystemSet.Control,
        after: FlyingSwordSystemSet.Request,
    } as const,
    formation: {
        inSet: FlyingSwordSystemSet.Formation,
        after: FlyingSwordSystemSet.Skill,
    } as const,
    orientation: {
        inSet: FlyingSwordSystemSet.Orientation,
        after: MotionSystemSet.Integrate3,
    } as const,
});

function applyFlyingSwordCenterRequests(
    commands: Commands,
    world: World,
    scratch: Mut<FlyingSwordEntityAccessState>,
    requests: CenterRequests,
): void {
    const component = world.findComponent(
        FlyingSwordGroupCenter3Storage,
    );
    const componentId = component?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const groups = data[SetFlyingSwordCenterRequest.Group];
        const xs = data[SetFlyingSwordCenterRequest.X];
        const ys = data[SetFlyingSwordCenterRequest.Y];
        const zs = data[SetFlyingSwordCenterRequest.Z];
        for (let row = 0; row < count; row++) {
            if (
                componentId !== undefined &&
                world.resolve(groups[row], access)
            ) {
                const archetype = access.archetype;
                const center = archetype?.getComp(
                    access.row,
                    componentId,
                ) as ComponentColumns<FlyingSwordGroupCenter3Storage> | null;
                if (archetype && center) {
                    const groupRow = archetype.rowIdxOf(access.row);
                    center[Float3.X][groupRow] = xs[row];
                    center[Float3.Y][groupRow] = ys[row];
                    center[Float3.Z][groupRow] = zs[row];
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function applyFlyingSwordFocusRequests(
    commands: Commands,
    world: World,
    scratch: Mut<FlyingSwordEntityAccessState>,
    requests: FocusRequests,
): void {
    const targetId = world.findComponent(
        FlyingSwordGroupTarget3Storage,
    )?.id;
    const controlId = world.findComponent(
        FlyingSwordControlStorage,
    )?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const groups = data[FocusFlyingSwordRequest.Group];
        const xs = data[FocusFlyingSwordRequest.TargetX];
        const ys = data[FocusFlyingSwordRequest.TargetY];
        const zs = data[FocusFlyingSwordRequest.TargetZ];
        for (let row = 0; row < count; row++) {
            if (
                targetId !== undefined &&
                controlId !== undefined &&
                world.resolve(groups[row], access)
            ) {
                const archetype = access.archetype;
                const target = archetype?.getComp(
                    access.row,
                    targetId,
                ) as ComponentColumns<FlyingSwordGroupTarget3Storage> | null;
                const control = archetype?.getComp(
                    access.row,
                    controlId,
                ) as ComponentColumns<FlyingSwordControlStorage> | null;
                if (archetype && target && control) {
                    const groupRow = archetype.rowIdxOf(access.row);
                    target[Float3.X][groupRow] = xs[row];
                    target[Float3.Y][groupRow] = ys[row];
                    target[Float3.Z][groupRow] = zs[row];
                    control[FlyingSwordControl.Mode][groupRow] =
                        FlyingSwordMode.Focus;
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function applyFlyingSwordModeRequests(
    commands: Commands,
    world: World,
    scratch: Mut<FlyingSwordEntityAccessState>,
    requests: ModeRequests,
): void {
    const componentId = world.findComponent(
        FlyingSwordControlStorage,
    )?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const groups = data[SetFlyingSwordModeRequest.Group];
        const modes = data[SetFlyingSwordModeRequest.Mode];
        for (let row = 0; row < count; row++) {
            if (
                componentId !== undefined &&
                world.resolve(groups[row], access)
            ) {
                const archetype = access.archetype;
                const control = archetype?.getComp(
                    access.row,
                    componentId,
                ) as ComponentColumns<FlyingSwordControlStorage> | null;
                if (archetype && control) {
                    const groupRow = archetype.rowIdxOf(access.row);
                    control[FlyingSwordControl.Mode][groupRow] =
                        modes[row];
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function snapshotFlyingSwordGroups(
    time: Readonly<TimeState>,
    world: World,
    scratch: Mut<FlyingSwordEntityAccessState>,
    runtime: Mut<FlyingSwordGroupIndexState>,
    groups: Groups,
): void {
    const tick = time.tick;
    const directionId = world.findComponent(Direction3Type)?.id;
    const access = scratch.access;
    const iter = groups.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            identities,
            centers,
            targets,
            formations,
            controls,
        ] = iter.current;
        const owners = identities[FlyingSwordGroup.Owner];
        const centerXs = centers[Float3.X];
        const centerYs = centers[Float3.Y];
        const centerZs = centers[Float3.Z];
        const targetXs = targets[Float3.X];
        const targetYs = targets[Float3.Y];
        const targetZs = targets[Float3.Z];
        const orbitRadii =
            formations[FlyingSwordFormation.OrbitRadius];
        const orbitHeights =
            formations[FlyingSwordFormation.OrbitHeight];
        const angularSpeeds =
            formations[FlyingSwordFormation.AngularSpeed];
        const verticalAmplitudes =
            formations[FlyingSwordFormation.VerticalAmplitude];
        const verticalSpeeds =
            formations[FlyingSwordFormation.VerticalSpeed];
        const formationSizes =
            formations[FlyingSwordFormation.Size];
        const modes = controls[FlyingSwordControl.Mode];
        for (let row = 0; row < count; row++) {
            const group = entities[row];
            let index = runtime.indices.get(group);
            if (index === undefined) {
                index = runtime.count++;
                runtime.groups[index] = group;
                runtime.indices.set(group, index);
            }
            runtime.centerXs[index] = centerXs[row];
            runtime.centerYs[index] = centerYs[row];
            runtime.centerZs[index] = centerZs[row];
            let forwardX = runtime.forwardXs[index] ?? 0;
            let forwardZ = runtime.forwardZs[index] ?? 1;
            if (
                directionId !== undefined &&
                world.resolve(owners[row], access)
            ) {
                const archetype = access.archetype;
                const directions = archetype?.getComp(
                    access.row,
                    directionId,
                ) as ComponentColumns<Direction3Type> | null;
                if (archetype && directions) {
                    const ownerRow = archetype.rowIdxOf(access.row);
                    const x = directions[Float3.X][ownerRow];
                    const z = directions[Float3.Z][ownerRow];
                    const length = Math.sqrt(x * x + z * z);
                    if (length > DIRECTION_EPSILON) {
                        forwardX = x / length;
                        forwardZ = z / length;
                    }
                }
            }
            runtime.forwardXs[index] = forwardX;
            runtime.forwardZs[index] = forwardZ;
            runtime.targetXs[index] = targetXs[row];
            runtime.targetYs[index] = targetYs[row];
            runtime.targetZs[index] = targetZs[row];
            runtime.orbitRadii[index] = orbitRadii[row];
            runtime.orbitHeights[index] = orbitHeights[row];
            runtime.angularSpeeds[index] = angularSpeeds[row];
            runtime.verticalAmplitudes[index] =
                verticalAmplitudes[row];
            runtime.verticalSpeeds[index] = verticalSpeeds[row];
            runtime.formationSizes[index] =
                Math.max(1, formationSizes[row]);
            runtime.modes[index] = modes[row];
            runtime.marks[index] = tick;
        }
    }
    for (let index = runtime.count - 1; index >= 0; index--) {
        if (runtime.marks[index] !== tick) {
            removeGroupIndex(runtime, index);
        }
    }
}

function formFlyingSwordGoals(
    time: Readonly<TimeState>,
    runtime: Readonly<FlyingSwordGroupIndexState>,
    swords: Swords,
): void {
    const tick = time.tick;
    const elapsed = time.elapsed;
    const groupIndices = runtime.indices;
    const iter = swords.iter();
    while (iter.next()) {
        const [count, , members, , , , , , formationGoals] =
            iter.current;
        const groups = members[FlyingSwordMember.Group];
        const slots = members[FlyingSwordMember.Slot];
        const formationGoalXs = formationGoals[Float3.X];
        const formationGoalYs = formationGoals[Float3.Y];
        const formationGoalZs = formationGoals[Float3.Z];

        for (let row = 0; row < count; row++) {
            const group = groupIndices.get(groups[row]);
            if (
                group === undefined ||
                runtime.marks[group] !== tick
            ) {
                continue;
            }

            const slot = slots[row];
            const formationSize = runtime.formationSizes[group];
            const phase = elapsed * runtime.angularSpeeds[group] +
                slot * Math.PI * 2 / formationSize;
            let radius = runtime.orbitRadii[group];
            let centerX = runtime.centerXs[group];
            let centerY = runtime.centerYs[group];
            let centerZ = runtime.centerZs[group];
            let height = runtime.orbitHeights[group];
            let verticalAmplitude =
                runtime.verticalAmplitudes[group];

            if (runtime.modes[group] === FlyingSwordMode.Recall) {
                const normalizedSlot = formationSize <= 1
                    ? 0
                    : (
                        slot % formationSize /
                        (formationSize - 1) * 2 - 1
                    );
                const fanAngle =
                    normalizedSlot * RECALL_FAN_HALF_ANGLE;
                const cosine = Math.cos(fanAngle);
                const sine = Math.sin(fanAngle);
                const backX = -runtime.forwardXs[group];
                const backZ = -runtime.forwardZs[group];
                const fanX = backX * cosine - backZ * sine;
                const fanZ = backX * sine + backZ * cosine;
                const fanRadius = Math.min(
                    RECALL_MAXIMUM_RADIUS,
                    Math.max(RECALL_MINIMUM_RADIUS, radius),
                );
                const fanHeight =
                    Math.max(RECALL_MINIMUM_HEIGHT, height * 0.65) +
                    (1 - Math.abs(normalizedSlot)) *
                    RECALL_CENTER_HEIGHT_BONUS;
                const wave = Math.sin(
                    elapsed * runtime.verticalSpeeds[group] +
                    normalizedSlot * Math.PI,
                ) * verticalAmplitude * RECALL_WAVE_MULTIPLIER;
                formationGoalXs[row] = centerX + fanX * fanRadius;
                formationGoalYs[row] = centerY + fanHeight + wave;
                formationGoalZs[row] = centerZ + fanZ * fanRadius;
                continue;
            }

            if (runtime.modes[group] === FlyingSwordMode.Focus) {
                centerX = runtime.targetXs[group];
                centerY = runtime.targetYs[group];
                centerZ = runtime.targetZs[group];
                radius *= 0.28;
                height *= 0.72;
                verticalAmplitude *= 0.65;
            }

            const slotPhase =
                slot * Math.PI * 2 / formationSize;
            const verticalPhase =
                elapsed * runtime.verticalSpeeds[group] + slotPhase;
            const heightWave = Math.sin(verticalPhase) +
                Math.sin(verticalPhase * 0.5 + phase) * 0.25;
            formationGoalXs[row] =
                centerX + Math.cos(phase) * radius;
            formationGoalYs[row] =
                centerY +
                height +
                heightWave * verticalAmplitude;
            formationGoalZs[row] =
                centerZ + Math.sin(phase) * radius;
        }
    }
}

function orientIdleFlyingSwords(
    runtime: Readonly<FlyingSwordGroupIndexState>,
    swords: OrientedSwords,
): void {
    const groupIndices = runtime.indices;
    const iter = swords.iter();
    while (iter.next()) {
        const [count, , members, directions, actions] =
            iter.current;
        if (actions !== undefined) continue;
        const groups = members[FlyingSwordMember.Group];
        const directionXs = directions[Float3.X];
        const directionYs = directions[Float3.Y];
        const directionZs = directions[Float3.Z];
        for (let row = 0; row < count; row++) {
            const group = groupIndices.get(groups[row]);
            if (group === undefined) continue;
            const mode = runtime.modes[group];
            if (
                mode !== FlyingSwordMode.Orbit &&
                mode !== FlyingSwordMode.Recall
            ) {
                continue;
            }
            directionXs[row] = 0;
            directionYs[row] = 1;
            directionZs[row] = 0;
        }
    }
}

function removeGroupIndex(
    runtime: Mut<FlyingSwordGroupIndexState>,
    index: number,
): void {
    const last = runtime.count - 1;
    const group = runtime.groups[index];
    runtime.indices.delete(group);
    if (index !== last) {
        const moved = runtime.groups[last];
        runtime.groups[index] = moved;
        runtime.centerXs[index] = runtime.centerXs[last];
        runtime.centerYs[index] = runtime.centerYs[last];
        runtime.centerZs[index] = runtime.centerZs[last];
        runtime.forwardXs[index] = runtime.forwardXs[last];
        runtime.forwardZs[index] = runtime.forwardZs[last];
        runtime.targetXs[index] = runtime.targetXs[last];
        runtime.targetYs[index] = runtime.targetYs[last];
        runtime.targetZs[index] = runtime.targetZs[last];
        runtime.orbitRadii[index] = runtime.orbitRadii[last];
        runtime.orbitHeights[index] = runtime.orbitHeights[last];
        runtime.angularSpeeds[index] = runtime.angularSpeeds[last];
        runtime.verticalAmplitudes[index] =
            runtime.verticalAmplitudes[last];
        runtime.verticalSpeeds[index] =
            runtime.verticalSpeeds[last];
        runtime.formationSizes[index] =
            runtime.formationSizes[last];
        runtime.modes[index] = runtime.modes[last];
        runtime.marks[index] = runtime.marks[last];
        runtime.indices.set(moved, index);
    }
    runtime.count = last;
}

const DIRECTION_EPSILON = 1e-6;
const RECALL_FAN_HALF_ANGLE = Math.PI / 3;
const RECALL_MINIMUM_RADIUS = 1.2;
const RECALL_MAXIMUM_RADIUS = 2.4;
const RECALL_MINIMUM_HEIGHT = 0.9;
const RECALL_CENTER_HEIGHT_BONUS = 0.35;
const RECALL_WAVE_MULTIPLIER = 0.12;
