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
    FlyingSwordActiveFormation,
    FlyingSwordBehavior,
    FlyingSwordControl,
    FlyingSwordFormation,
    FlyingSwordGroup,
    FlyingSwordMember,
    FlyingSwordMode,
    FlyingSwordStance,
} from "../types";
import { FlyingSwordEntityAccessState } from "./access-state";
import {
    FlyingSwordBaseStorageQuery,
    FlyingSwordGroupStorageQuery,
    FlyingSwordOrientationStorageQuery,
    FocusFlyingSwordRequestStorageQuery,
    SetFlyingSwordCenterRequestStorageQuery,
    SetFlyingSwordFormationSizeRequestStorageQuery,
    SetFlyingSwordModeRequestStorageQuery,
    SetFlyingSwordActiveFormationRequestStorageQuery,
    SetFlyingSwordStanceRequestStorageQuery,
} from "./queries";
import { FlyingSwordGroupIndexState } from "./runtime-state";
import {
    FlyingSwordBehaviorStorage,
    FlyingSwordControlStorage,
    FlyingSwordFormationStorage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupTarget3Storage,
    FocusFlyingSwordRequest,
    SetFlyingSwordCenterRequest,
    SetFlyingSwordFormationSizeRequest,
    SetFlyingSwordModeRequest,
    SetFlyingSwordActiveFormationRequest,
    SetFlyingSwordStanceRequest,
} from "./storage";

type Groups = QueryOf<typeof FlyingSwordGroupStorageQuery>;
type Swords = QueryOf<typeof FlyingSwordBaseStorageQuery>;
type CenterRequests =
    QueryOf<typeof SetFlyingSwordCenterRequestStorageQuery>;
type FocusRequests =
    QueryOf<typeof FocusFlyingSwordRequestStorageQuery>;
type ModeRequests =
    QueryOf<typeof SetFlyingSwordModeRequestStorageQuery>;
type FormationSizeRequests =
    QueryOf<typeof SetFlyingSwordFormationSizeRequestStorageQuery>;
type StanceRequests =
    QueryOf<typeof SetFlyingSwordStanceRequestStorageQuery>;
type ActiveFormationRequests =
    QueryOf<typeof SetFlyingSwordActiveFormationRequestStorageQuery>;
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

export const applyFlyingSwordFormationSizeRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordFormationSizeRequests,
    [
        Commands,
        World,
        Write(FlyingSwordEntityAccessState),
        SetFlyingSwordFormationSizeRequestStorageQuery,
    ],
);

export const applyFlyingSwordStanceRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordStanceRequests,
    [
        Commands,
        World,
        Write(FlyingSwordEntityAccessState),
        SetFlyingSwordStanceRequestStorageQuery,
    ],
);

export const applyFlyingSwordActiveFormationRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordActiveFormationRequests,
    [
        Commands,
        World,
        Write(FlyingSwordEntityAccessState),
        SetFlyingSwordActiveFormationRequestStorageQuery,
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
    [
        TimeState,
        FlyingSwordGroupIndexState,
        FlyingSwordOrientationStorageQuery,
    ],
);

export const FlyingSwordSystemOptions = Object.freeze({
    centerRequests: { inSet: FlyingSwordSystemSet.Request } as const,
    focusRequests: { inSet: FlyingSwordSystemSet.Request } as const,
    modeRequests: { inSet: FlyingSwordSystemSet.Request } as const,
    formationSizeRequests: {
        inSet: FlyingSwordSystemSet.Request,
    } as const,
    stanceRequests: {
        inSet: FlyingSwordSystemSet.Request,
    } as const,
    activeFormationRequests: {
        inSet: FlyingSwordSystemSet.Request,
    } as const,
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

function applyFlyingSwordFormationSizeRequests(
    commands: Commands,
    world: World,
    scratch: Mut<FlyingSwordEntityAccessState>,
    requests: FormationSizeRequests,
): void {
    const componentId = world.findComponent(
        FlyingSwordFormationStorage,
    )?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const groups =
            data[SetFlyingSwordFormationSizeRequest.Group];
        const sizes =
            data[SetFlyingSwordFormationSizeRequest.Size];
        for (let row = 0; row < count; row++) {
            if (
                componentId !== undefined &&
                world.resolve(groups[row], access)
            ) {
                const archetype = access.archetype;
                const formation = archetype?.getComp(
                    access.row,
                    componentId,
                ) as ComponentColumns<FlyingSwordFormationStorage> | null;
                if (archetype && formation) {
                    const groupRow = archetype.rowIdxOf(access.row);
                    formation[FlyingSwordFormation.Size][groupRow] =
                        sizes[row];
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function applyFlyingSwordStanceRequests(
    commands: Commands,
    world: World,
    scratch: Mut<FlyingSwordEntityAccessState>,
    requests: StanceRequests,
): void {
    const componentId = world.findComponent(
        FlyingSwordBehaviorStorage,
    )?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const groups = data[SetFlyingSwordStanceRequest.Group];
        const stances = data[SetFlyingSwordStanceRequest.Stance];
        for (let row = 0; row < count; row++) {
            if (
                componentId !== undefined &&
                world.resolve(groups[row], access)
            ) {
                const archetype = access.archetype;
                const behaviors = archetype?.getComp(
                    access.row,
                    componentId,
                ) as ComponentColumns<FlyingSwordBehaviorStorage> | null;
                if (archetype && behaviors) {
                    const groupRow = archetype.rowIdxOf(access.row);
                    behaviors[FlyingSwordBehavior.Stance][groupRow] =
                        stances[row];
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function applyFlyingSwordActiveFormationRequests(
    commands: Commands,
    world: World,
    scratch: Mut<FlyingSwordEntityAccessState>,
    requests: ActiveFormationRequests,
): void {
    const componentId = world.findComponent(
        FlyingSwordBehaviorStorage,
    )?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const groups =
            data[SetFlyingSwordActiveFormationRequest.Group];
        const formations =
            data[SetFlyingSwordActiveFormationRequest.Formation];
        const forwardXs =
            data[SetFlyingSwordActiveFormationRequest.ForwardX];
        const forwardZs =
            data[SetFlyingSwordActiveFormationRequest.ForwardZ];
        for (let row = 0; row < count; row++) {
            if (
                componentId !== undefined &&
                world.resolve(groups[row], access)
            ) {
                const archetype = access.archetype;
                const behaviors = archetype?.getComp(
                    access.row,
                    componentId,
                ) as ComponentColumns<FlyingSwordBehaviorStorage> | null;
                if (archetype && behaviors) {
                    const groupRow = archetype.rowIdxOf(access.row);
                    behaviors[FlyingSwordBehavior.ActiveFormation][groupRow] =
                        formations[row];
                    behaviors[FlyingSwordBehavior.ActiveForwardX][groupRow] =
                        forwardXs[row];
                    behaviors[FlyingSwordBehavior.ActiveForwardZ][groupRow] =
                        forwardZs[row];
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
            behaviors,
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
        const stances = behaviors[FlyingSwordBehavior.Stance];
        const activeFormations =
            behaviors[FlyingSwordBehavior.ActiveFormation];
        const activeForwardXs =
            behaviors[FlyingSwordBehavior.ActiveForwardX];
        const activeForwardZs =
            behaviors[FlyingSwordBehavior.ActiveForwardZ];
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
            runtime.stances[index] = stances[row];
            runtime.activeFormations[index] =
                activeFormations[row];
            runtime.activeForwardXs[index] =
                activeForwardXs[row];
            runtime.activeForwardZs[index] =
                activeForwardZs[row];
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

            if (
                runtime.activeFormations[group] ===
                FlyingSwordActiveFormation.FusionSpiral
            ) {
                const forwardX = runtime.activeForwardXs[group];
                const forwardZ = runtime.activeForwardZs[group];
                const rightX = forwardZ;
                const rightZ = -forwardX;
                const progress = formationSize <= 1
                    ? 1
                    : slot % formationSize / (formationSize - 1);
                const spiralPhase =
                    elapsed * FUSION_SPIRAL_SPEED +
                    progress * Math.PI * 2 * FUSION_SPIRAL_TURNS;
                const longitudinal =
                    FUSION_SPIRAL_START +
                    progress * FUSION_SPIRAL_LENGTH;
                const spiralRadius =
                    FUSION_SPIRAL_BACK_RADIUS +
                    (
                        FUSION_SPIRAL_TIP_RADIUS -
                        FUSION_SPIRAL_BACK_RADIUS
                    ) * progress;
                const radial = Math.cos(spiralPhase) *
                    spiralRadius;
                formationGoalXs[row] =
                    centerX + forwardX * longitudinal + rightX * radial;
                formationGoalYs[row] =
                    centerY + FUSION_SPIRAL_AXIS_HEIGHT +
                    Math.sin(spiralPhase) * spiralRadius;
                formationGoalZs[row] =
                    centerZ + forwardZ * longitudinal + rightZ * radial;
                continue;
            }

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
                const fanPhase =
                    slot * Math.PI * 2 / formationSize;
                const radialBreath = Math.sin(
                    elapsed * RECALL_BREATH_SPEED +
                    fanPhase * RECALL_BREATH_PHASE_SCALE,
                ) * Math.min(
                    RECALL_MAXIMUM_BREATH_RADIUS,
                    verticalAmplitude *
                    RECALL_BREATH_AMPLITUDE_MULTIPLIER,
                );
                const fanHeight =
                    Math.max(RECALL_MINIMUM_HEIGHT, height * 0.65) +
                    (1 - Math.abs(normalizedSlot)) *
                    RECALL_CENTER_HEIGHT_BONUS;
                const wave = Math.sin(
                    elapsed * runtime.verticalSpeeds[group] +
                    fanPhase,
                ) * verticalAmplitude * RECALL_WAVE_MULTIPLIER;
                const animatedRadius = fanRadius + radialBreath;
                formationGoalXs[row] =
                    centerX + fanX * animatedRadius;
                formationGoalYs[row] = centerY + fanHeight + wave;
                formationGoalZs[row] =
                    centerZ + fanZ * animatedRadius;
                continue;
            }

            if (
                runtime.stances[group] === FlyingSwordStance.Formation &&
                runtime.modes[group] === FlyingSwordMode.Orbit
            ) {
                const route = slot % FORMATION_ROUTE_COUNT;
                const routePhase = formationRoutePhase(
                    elapsed,
                    runtime.angularSpeeds[group],
                    slot,
                    formationSize,
                    route,
                );
                writeFormationPathPoint(
                    route,
                    routePhase,
                    radius,
                    formationPathPoint,
                );
                const forwardX = runtime.forwardXs[group];
                const forwardZ = runtime.forwardZs[group];
                const rightX = forwardZ;
                const rightZ = -forwardX;
                formationGoalXs[row] =
                    centerX +
                    rightX * formationPathPoint.lateral +
                    forwardX * formationPathPoint.depth;
                formationGoalYs[row] =
                    centerY + height * FORMATION_HEIGHT_MULTIPLIER +
                    formationRouteHeight(route) +
                    Math.sin(routePhase * 2 + slot * 0.7) *
                    Math.max(
                        FORMATION_PATH_WAVE,
                        verticalAmplitude * 0.35,
                    );
                formationGoalZs[row] =
                    centerZ +
                    rightZ * formationPathPoint.lateral +
                    forwardZ * formationPathPoint.depth;
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
    time: Readonly<TimeState>,
    runtime: Readonly<FlyingSwordGroupIndexState>,
    swords: OrientedSwords,
): void {
    const elapsed = time.elapsed;
    const groupIndices = runtime.indices;
    const iter = swords.iter();
    while (iter.next()) {
        const [count, , members, directions, actions, tasks] =
            iter.current;
        if (actions !== undefined || tasks !== undefined) continue;
        const groups = members[FlyingSwordMember.Group];
        const slots = members[FlyingSwordMember.Slot];
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
            if (mode === FlyingSwordMode.Orbit) {
                if (
                    runtime.activeFormations[group] ===
                    FlyingSwordActiveFormation.FusionSpiral
                ) {
                    const formationSize =
                        runtime.formationSizes[group];
                    const progress = formationSize <= 1
                        ? 1
                        : slots[row] % formationSize /
                            (formationSize - 1);
                    const phase =
                        elapsed * FUSION_SPIRAL_SPEED +
                        progress * Math.PI * 2 *
                            FUSION_SPIRAL_TURNS;
                    const forwardX = runtime.activeForwardXs[group];
                    const forwardZ = runtime.activeForwardZs[group];
                    const rightX = forwardZ;
                    const rightZ = -forwardX;
                    const directionWeight =
                        FUSION_DIRECTION_WEIGHT +
                        progress * FUSION_TIP_DIRECTION_BONUS;
                    const tangentX =
                        forwardX * directionWeight -
                        rightX * Math.sin(phase) *
                            FUSION_TANGENT_WEIGHT;
                    const tangentY =
                        Math.cos(phase) * FUSION_TANGENT_WEIGHT;
                    const tangentZ =
                        forwardZ * directionWeight -
                        rightZ * Math.sin(phase) *
                            FUSION_TANGENT_WEIGHT;
                    const length = Math.sqrt(
                        tangentX * tangentX +
                        tangentY * tangentY +
                        tangentZ * tangentZ,
                    );
                    if (length > DIRECTION_EPSILON) {
                        directionXs[row] = tangentX / length;
                        directionYs[row] = tangentY / length;
                        directionZs[row] = tangentZ / length;
                    }
                    continue;
                }
                if (
                    runtime.stances[group] ===
                    FlyingSwordStance.Formation
                ) {
                    const slot = slots[row];
                    const formationSize =
                        runtime.formationSizes[group];
                    const route = slot % FORMATION_ROUTE_COUNT;
                    const phase = formationRoutePhase(
                        elapsed,
                        runtime.angularSpeeds[group],
                        slot,
                        formationSize,
                        route,
                    );
                    const nextPhase = formationRoutePhase(
                        elapsed + FORMATION_TANGENT_TIME_STEP,
                        runtime.angularSpeeds[group],
                        slot,
                        formationSize,
                        route,
                    );
                    const radius = runtime.orbitRadii[group];
                    writeFormationPathPoint(
                        route,
                        phase,
                        radius,
                        formationPathPoint,
                    );
                    writeFormationPathPoint(
                        route,
                        nextPhase,
                        radius,
                        formationPathPointAhead,
                    );
                    const forwardX = runtime.forwardXs[group];
                    const forwardZ = runtime.forwardZs[group];
                    const rightX = forwardZ;
                    const rightZ = -forwardX;
                    const lateral =
                        formationPathPointAhead.lateral -
                        formationPathPoint.lateral;
                    const depth =
                        formationPathPointAhead.depth -
                        formationPathPoint.depth;
                    const tangentX =
                        rightX * lateral + forwardX * depth;
                    const tangentY =
                        Math.sin(nextPhase * 2 + slot * 0.7) -
                        Math.sin(phase * 2 + slot * 0.7);
                    const tangentZ =
                        rightZ * lateral + forwardZ * depth;
                    const length = Math.sqrt(
                        tangentX * tangentX +
                        tangentY * tangentY +
                        tangentZ * tangentZ,
                    );
                    directionXs[row] = tangentX / length;
                    directionYs[row] = tangentY / length;
                    directionZs[row] = tangentZ / length;
                    continue;
                }
                directionXs[row] = 0;
                directionYs[row] = 1;
                directionZs[row] = 0;
                continue;
            }
            const formationSize = runtime.formationSizes[group];
            const slot = slots[row];
            const normalizedSlot = formationSize <= 1
                ? 0
                : (
                    slot % formationSize /
                    (formationSize - 1) * 2 - 1
                );
            const slotPhase =
                slot * Math.PI * 2 / formationSize;
            const sway = Math.sin(
                elapsed * RECALL_SWAY_SPEED + slotPhase,
            ) * RECALL_SWAY_ANGLE;
            const angle =
                normalizedSlot * RECALL_MAXIMUM_TILT + sway;
            const horizontal = Math.sin(angle);
            const upward = Math.cos(angle);
            const rightX = runtime.forwardZs[group];
            const rightZ = -runtime.forwardXs[group];
            directionXs[row] = rightX * horizontal;
            directionYs[row] = upward;
            directionZs[row] = rightZ * horizontal;
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
        runtime.stances[index] = runtime.stances[last];
        runtime.activeFormations[index] =
            runtime.activeFormations[last];
        runtime.activeForwardXs[index] =
            runtime.activeForwardXs[last];
        runtime.activeForwardZs[index] =
            runtime.activeForwardZs[last];
        runtime.marks[index] = runtime.marks[last];
        runtime.indices.set(moved, index);
    }
    runtime.count = last;
}

function formationRoutePhase(
    elapsed: number,
    angularSpeed: number,
    slot: number,
    formationSize: number,
    route: number,
): number {
    const routeCount = Math.max(
        1,
        Math.floor(
            (formationSize + FORMATION_ROUTE_COUNT - 1 - route) /
            FORMATION_ROUTE_COUNT,
        ),
    );
    const routeSlot = Math.floor(slot / FORMATION_ROUTE_COUNT);
    const offset = routeSlot * Math.PI * 2 / routeCount;
    const speedScale = route === 0
        ? 0.86
        : route === 1
            ? 1.18
            : -1.03;
    return elapsed * angularSpeed *
        FORMATION_SPEED_MULTIPLIER * speedScale + offset;
}

function writeFormationPathPoint(
    route: number,
    phase: number,
    radius: number,
    out: { lateral: number; depth: number },
): void {
    if (route === 0) {
        writeRegularPolygonPoint(
            phase,
            8,
            radius * FORMATION_OUTER_RADIUS_MULTIPLIER,
            Math.PI / 8,
            out,
        );
        return;
    }
    writeRegularPolygonPoint(
        phase,
        4,
        radius * FORMATION_INNER_RADIUS_MULTIPLIER,
        route === 1 ? Math.PI / 4 : 0,
        out,
    );
}

function writeRegularPolygonPoint(
    phase: number,
    sides: number,
    radius: number,
    rotation: number,
    out: { lateral: number; depth: number },
): void {
    const turns = phase / (Math.PI * 2);
    const wrapped = turns - Math.floor(turns);
    const edgePosition = wrapped * sides;
    const edge = Math.floor(edgePosition);
    const progress = edgePosition - edge;
    const startAngle = rotation + edge * Math.PI * 2 / sides;
    const endAngle =
        rotation + (edge + 1) * Math.PI * 2 / sides;
    out.lateral =
        (
            Math.cos(startAngle) +
            (Math.cos(endAngle) - Math.cos(startAngle)) * progress
        ) * radius;
    out.depth =
        (
            Math.sin(startAngle) +
            (Math.sin(endAngle) - Math.sin(startAngle)) * progress
        ) * radius;
}

function formationRouteHeight(route: number): number {
    return route === 0 ? 0 : route === 1 ? 0.18 : -0.12;
}

const DIRECTION_EPSILON = 1e-6;
const RECALL_FAN_HALF_ANGLE = Math.PI / 3;
const RECALL_MINIMUM_RADIUS = 1.2;
const RECALL_MAXIMUM_RADIUS = 2.4;
const RECALL_MINIMUM_HEIGHT = 0.9;
const RECALL_CENTER_HEIGHT_BONUS = 0.35;
const RECALL_WAVE_MULTIPLIER = 0.32;
const RECALL_BREATH_SPEED = 1.35;
const RECALL_BREATH_PHASE_SCALE = 0.65;
const RECALL_BREATH_AMPLITUDE_MULTIPLIER = 0.14;
const RECALL_MAXIMUM_BREATH_RADIUS = 0.12;
const RECALL_MAXIMUM_TILT = Math.PI * 0.18;
const RECALL_SWAY_ANGLE = Math.PI / 72;
const RECALL_SWAY_SPEED = 1.8;
const FORMATION_ROUTE_COUNT = 3;
const FORMATION_SPEED_MULTIPLIER = 1.15;
const FORMATION_OUTER_RADIUS_MULTIPLIER = 0.94;
const FORMATION_INNER_RADIUS_MULTIPLIER = 0.78;
const FORMATION_HEIGHT_MULTIPLIER = 0.76;
const FORMATION_PATH_WAVE = 0.08;
const FORMATION_TANGENT_TIME_STEP = 1 / 120;
const FUSION_SPIRAL_SPEED = 12.5;
const FUSION_SPIRAL_TURNS = 2.25;
const FUSION_SPIRAL_START = 0.65;
const FUSION_SPIRAL_LENGTH = 4.15;
const FUSION_SPIRAL_BACK_RADIUS = 1.12;
const FUSION_SPIRAL_TIP_RADIUS = 0.12;
const FUSION_SPIRAL_AXIS_HEIGHT = 0.92;
const FUSION_DIRECTION_WEIGHT = 4.8;
const FUSION_TIP_DIRECTION_BONUS = 2.2;
const FUSION_TANGENT_WEIGHT = 0.72;
const formationPathPoint = { lateral: 0, depth: 0 };
const formationPathPointAhead = { lateral: 0, depth: 0 };
