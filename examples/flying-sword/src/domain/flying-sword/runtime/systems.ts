/** 飞剑示例本地领域运行时。 */
import {
    Commands,
    Update,
    World,
    Write,
    defSystem,
    type ComponentColumns,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    Direction3Type,
    Float3,
} from "@zero-ecs/math/3d";
import { MotionSystemSet } from "@zero-ecs/motion/3d";
import { FlyingSwordFormationCatalog } from "../formation-catalog";
import type {
    FlyingSwordFormationRouteSample,
    FlyingSwordFormationSlotSample,
} from "../formation-types";
import { FlyingSwordSystemSet } from "../system-set";
import {
    FlyingSwordActiveFormation,
    FlyingSwordBehavior,
    FlyingSwordControl,
    FlyingSwordFormation,
    FlyingSwordFormationPlan,
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
    SetFlyingSwordFormationTuningRequestStorageQuery,
    SetFlyingSwordFormationPlanRequestStorageQuery,
    SetFlyingSwordModeRequestStorageQuery,
    SetFlyingSwordActiveFormationRequestStorageQuery,
    SetFlyingSwordStanceRequestStorageQuery,
} from "./queries";
import { FlyingSwordGroupIndexState } from "./runtime-state";
import {
    FlyingSwordBehaviorStorage,
    FlyingSwordControlStorage,
    FlyingSwordFormationStorage,
    FlyingSwordFormationPlanStorage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupTarget3Storage,
    FocusFlyingSwordRequest,
    SetFlyingSwordCenterRequest,
    SetFlyingSwordFormationSizeRequest,
    SetFlyingSwordFormationTuningRequest,
    SetFlyingSwordFormationPlanRequest,
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
type FormationTuningRequests =
    QueryOf<typeof SetFlyingSwordFormationTuningRequestStorageQuery>;
type FormationPlanRequests =
    QueryOf<typeof SetFlyingSwordFormationPlanRequestStorageQuery>;
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
        TimeState,
        Write(FlyingSwordEntityAccessState),
        Write(FlyingSwordGroupIndexState),
        FocusFlyingSwordRequestStorageQuery,
    ],
);

export const applyFlyingSwordModeRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordModeRequests,
    [
        Commands,
        World,
        TimeState,
        Write(FlyingSwordEntityAccessState),
        Write(FlyingSwordGroupIndexState),
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

export const applyFlyingSwordFormationTuningRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordFormationTuningRequests,
    [
        Commands,
        World,
        TimeState,
        Write(FlyingSwordEntityAccessState),
        Write(FlyingSwordGroupIndexState),
        SetFlyingSwordFormationTuningRequestStorageQuery,
    ],
);

export const applyFlyingSwordFormationPlanRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordFormationPlanRequests,
    [
        Commands,
        World,
        TimeState,
        Write(FlyingSwordEntityAccessState),
        Write(FlyingSwordGroupIndexState),
        FlyingSwordFormationCatalog,
        SetFlyingSwordFormationPlanRequestStorageQuery,
    ],
);

export const applyFlyingSwordStanceRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordStanceRequests,
    [
        Commands,
        World,
        TimeState,
        Write(FlyingSwordEntityAccessState),
        Write(FlyingSwordGroupIndexState),
        SetFlyingSwordStanceRequestStorageQuery,
    ],
);

export const applyFlyingSwordActiveFormationRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordActiveFormationRequests,
    [
        Commands,
        World,
        TimeState,
        Write(FlyingSwordEntityAccessState),
        Write(FlyingSwordGroupIndexState),
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
    [
        TimeState,
        FlyingSwordFormationCatalog,
        FlyingSwordGroupIndexState,
        FlyingSwordBaseStorageQuery,
    ],
);

export const orientIdleFlyingSwordsSystem = defSystem(
    Update.fixed,
    orientIdleFlyingSwords,
    [
        TimeState,
        FlyingSwordFormationCatalog,
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
    formationTuningRequests: {
        inSet: FlyingSwordSystemSet.Request,
    } as const,
    formationPlanRequests: {
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
    time: Readonly<TimeState>,
    scratch: Mut<FlyingSwordEntityAccessState>,
    runtime: Mut<FlyingSwordGroupIndexState>,
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
                    markFormationTransition(
                        runtime,
                        groups[row],
                        time.tick,
                    );
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function applyFlyingSwordModeRequests(
    commands: Commands,
    world: World,
    time: Readonly<TimeState>,
    scratch: Mut<FlyingSwordEntityAccessState>,
    runtime: Mut<FlyingSwordGroupIndexState>,
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
                    markFormationTransition(
                        runtime,
                        groups[row],
                        time.tick,
                    );
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

function applyFlyingSwordFormationTuningRequests(
    commands: Commands,
    world: World,
    time: Readonly<TimeState>,
    scratch: Mut<FlyingSwordEntityAccessState>,
    runtime: Mut<FlyingSwordGroupIndexState>,
    requests: FormationTuningRequests,
): void {
    const componentId = world.findComponent(
        FlyingSwordFormationStorage,
    )?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const groups =
            data[SetFlyingSwordFormationTuningRequest.Group];
        const orbitRadii =
            data[SetFlyingSwordFormationTuningRequest.OrbitRadius];
        const angularSpeeds =
            data[SetFlyingSwordFormationTuningRequest.AngularSpeed];
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
                    const groupOrbitRadii =
                        formation[FlyingSwordFormation.OrbitRadius];
                    const groupAngularSpeeds =
                        formation[FlyingSwordFormation.AngularSpeed];
                    groupOrbitRadii[groupRow] = orbitRadii[row];
                    groupAngularSpeeds[groupRow] = angularSpeeds[row];
                    markFormationTransition(
                        runtime,
                        groups[row],
                        time.tick,
                    );
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function applyFlyingSwordFormationPlanRequests(
    commands: Commands,
    world: World,
    time: Readonly<TimeState>,
    scratch: Mut<FlyingSwordEntityAccessState>,
    runtime: Mut<FlyingSwordGroupIndexState>,
    catalog: Readonly<FlyingSwordFormationCatalog>,
    requests: FormationPlanRequests,
): void {
    const componentId = world.findComponent(
        FlyingSwordFormationPlanStorage,
    )?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const groups =
            data[SetFlyingSwordFormationPlanRequest.Group];
        const plans =
            data[SetFlyingSwordFormationPlanRequest.Plan];
        for (let row = 0; row < count; row++) {
            if (
                componentId !== undefined &&
                catalog.get(plans[row]) !== undefined &&
                world.resolve(groups[row], access)
            ) {
                const archetype = access.archetype;
                const plan = archetype?.getComp(
                    access.row,
                    componentId,
                ) as ComponentColumns<FlyingSwordFormationPlanStorage> | null;
                if (archetype && plan) {
                    const groupRow = archetype.rowIdxOf(access.row);
                    plan[FlyingSwordFormationPlan.Plan][groupRow] =
                        plans[row];
                    markFormationTransition(
                        runtime,
                        groups[row],
                        time.tick,
                    );
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function applyFlyingSwordStanceRequests(
    commands: Commands,
    world: World,
    time: Readonly<TimeState>,
    scratch: Mut<FlyingSwordEntityAccessState>,
    runtime: Mut<FlyingSwordGroupIndexState>,
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
                    markFormationTransition(
                        runtime,
                        groups[row],
                        time.tick,
                    );
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function applyFlyingSwordActiveFormationRequests(
    commands: Commands,
    world: World,
    time: Readonly<TimeState>,
    scratch: Mut<FlyingSwordEntityAccessState>,
    runtime: Mut<FlyingSwordGroupIndexState>,
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
                    const activeFormations =
                        behaviors[FlyingSwordBehavior.ActiveFormation];
                    const formationChanged =
                        activeFormations[groupRow] !== formations[row];
                    activeFormations[groupRow] = formations[row];
                    behaviors[FlyingSwordBehavior.ActiveForwardX][groupRow] =
                        forwardXs[row];
                    behaviors[FlyingSwordBehavior.ActiveForwardZ][groupRow] =
                        forwardZs[row];
                    if (formationChanged) {
                        markFormationTransition(
                            runtime,
                            groups[row],
                            time.tick,
                        );
                    }
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
            formationPlans,
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
        const planIds =
            formationPlans[FlyingSwordFormationPlan.Plan];
        for (let row = 0; row < count; row++) {
            const group = entities[row];
            let index = runtime.indices.get(group);
            if (index === undefined) {
                index = runtime.count++;
                runtime.groups[index] = group;
                runtime.indices.set(group, index);
                runtime.transitionStartTicks[index] =
                    tick - FORMATION_TRANSITION_TICKS;
            } else if (
                runtime.modes[index] !== modes[row] ||
                runtime.stances[index] !== stances[row] ||
                runtime.activeFormations[index] !==
                    activeFormations[row] ||
                runtime.formationPlans[index] !== planIds[row]
            ) {
                runtime.transitionStartTicks[index] = tick;
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
            runtime.formationPlans[index] = planIds[row];
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
    catalog: Readonly<FlyingSwordFormationCatalog>,
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
                writeFusionSlot(
                    slot,
                    formationSize,
                    elapsed,
                    fusionSlotPoint,
                );
                const radial = Math.cos(fusionSlotPoint.angle) *
                    fusionSlotPoint.radius;
                writeFormationGoal(
                    runtime,
                    group,
                    tick,
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    row,
                    centerX +
                        forwardX * fusionSlotPoint.longitudinal +
                        rightX * radial,
                    centerY + FUSION_SPIRAL_AXIS_HEIGHT +
                        Math.sin(fusionSlotPoint.angle) *
                        fusionSlotPoint.radius,
                    centerZ +
                        forwardZ * fusionSlotPoint.longitudinal +
                        rightZ * radial,
                );
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
                writeFormationGoal(
                    runtime,
                    group,
                    tick,
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    row,
                    centerX + fanX * animatedRadius,
                    centerY + fanHeight + wave,
                    centerZ + fanZ * animatedRadius,
                );
                continue;
            }

            if (
                runtime.stances[group] === FlyingSwordStance.Formation &&
                runtime.modes[group] === FlyingSwordMode.Orbit
            ) {
                const plan = runtime.formationPlans[group];
                catalog.resolveSlot(
                    plan,
                    slot,
                    formationSize,
                    formationSlotSample,
                );
                const routePhase =
                    (
                        elapsed +
                        FORMATION_GUIDANCE_LOOKAHEAD_SECONDS
                    ) *
                    runtime.angularSpeeds[group] +
                    formationSlotSample.phaseOffset;
                catalog.sampleRoute(
                    plan,
                    formationSlotSample.route,
                    routePhase,
                    formationRouteSample,
                );
                const forwardX = runtime.forwardXs[group];
                const forwardZ = runtime.forwardZs[group];
                const rightX = forwardZ;
                const rightZ = -forwardX;
                const lateral = formationRouteSample.x * radius;
                const depth = formationRouteSample.z * radius;
                writeFormationGoal(
                    runtime,
                    group,
                    tick,
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    row,
                    centerX +
                        rightX * lateral +
                        forwardX * depth,
                    centerY +
                        height * FORMATION_HEIGHT_MULTIPLIER +
                        formationRouteSample.y,
                    centerZ +
                        rightZ * lateral +
                        forwardZ * depth,
                );
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
            writeFormationGoal(
                runtime,
                group,
                tick,
                formationGoalXs,
                formationGoalYs,
                formationGoalZs,
                row,
                centerX + Math.cos(phase) * radius,
                centerY +
                    height +
                    heightWave * verticalAmplitude,
                centerZ + Math.sin(phase) * radius,
            );
        }
    }
}

function orientIdleFlyingSwords(
    time: Readonly<TimeState>,
    catalog: Readonly<FlyingSwordFormationCatalog>,
    runtime: Readonly<FlyingSwordGroupIndexState>,
    swords: OrientedSwords,
): void {
    const tick = time.tick;
    const elapsed = time.elapsed;
    const groupIndices = runtime.indices;
    const iter = swords.iter();
    while (iter.next()) {
        const [
            count,
            ,
            members,
            directions,
            idleDirections,
            actions,
            tasks,
        ] = iter.current;
        if (actions !== undefined || tasks !== undefined) continue;
        const groups = members[FlyingSwordMember.Group];
        const slots = members[FlyingSwordMember.Slot];
        const directionXs = directions[Float3.X];
        const directionYs = directions[Float3.Y];
        const directionZs = directions[Float3.Z];
        const idleDirectionXs = idleDirections[Float3.X];
        const idleDirectionYs = idleDirections[Float3.Y];
        const idleDirectionZs = idleDirections[Float3.Z];
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
                    writeFusionSlot(
                        slots[row],
                        formationSize,
                        elapsed,
                        fusionSlotPoint,
                    );
                    const forwardX = runtime.activeForwardXs[group];
                    const forwardZ = runtime.activeForwardZs[group];
                    const rightX = forwardZ;
                    const rightZ = -forwardX;
                    if (fusionSlotPoint.tip) {
                        writeTransitionDirection(
                            runtime,
                            group,
                            tick,
                            idleDirectionXs,
                            idleDirectionYs,
                            idleDirectionZs,
                            directionXs,
                            directionYs,
                            directionZs,
                            row,
                            forwardX,
                            0,
                            forwardZ,
                        );
                        continue;
                    }
                    const cosine = Math.cos(fusionSlotPoint.angle);
                    const sine = Math.sin(fusionSlotPoint.angle);
                    const radial = cosine * fusionSlotPoint.radius;
                    const height = sine * fusionSlotPoint.radius;
                    const axisDistance =
                        FUSION_UMBRELLA_APEX -
                        fusionSlotPoint.longitudinal;
                    const tangentX =
                        forwardX * axisDistance -
                        rightX * radial -
                        rightX * sine *
                            FUSION_UMBRELLA_TANGENT_WEIGHT;
                    const tangentY =
                        -height +
                        cosine * FUSION_UMBRELLA_TANGENT_WEIGHT;
                    const tangentZ =
                        forwardZ * axisDistance -
                        rightZ * radial -
                        rightZ * sine *
                            FUSION_UMBRELLA_TANGENT_WEIGHT;
                    const length = Math.sqrt(
                        tangentX * tangentX +
                        tangentY * tangentY +
                        tangentZ * tangentZ,
                    );
                    if (length > DIRECTION_EPSILON) {
                        writeTransitionDirection(
                            runtime,
                            group,
                            tick,
                            idleDirectionXs,
                            idleDirectionYs,
                            idleDirectionZs,
                            directionXs,
                            directionYs,
                            directionZs,
                            row,
                            tangentX / length,
                            tangentY / length,
                            tangentZ / length,
                        );
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
                    const plan = runtime.formationPlans[group];
                    catalog.resolveSlot(
                        plan,
                        slot,
                        formationSize,
                        formationSlotSample,
                    );
                    const phase =
                        elapsed *
                        runtime.angularSpeeds[group] +
                        formationSlotSample.phaseOffset;
                    catalog.sampleRoute(
                        plan,
                        formationSlotSample.route,
                        phase,
                        formationRouteSample,
                    );
                    const forwardX = runtime.forwardXs[group];
                    const forwardZ = runtime.forwardZs[group];
                    const rightX = forwardZ;
                    const rightZ = -forwardX;
                    const radius = runtime.orbitRadii[group];
                    const lateral =
                        formationRouteSample.tangentX * radius;
                    const depth =
                        formationRouteSample.tangentZ * radius;
                    const tangentX =
                        rightX * lateral + forwardX * depth;
                    const tangentY =
                        formationRouteSample.tangentY;
                    const tangentZ =
                        rightZ * lateral + forwardZ * depth;
                    const length = Math.sqrt(
                        tangentX * tangentX +
                        tangentY * tangentY +
                        tangentZ * tangentZ,
                    );
                    writeTransitionDirection(
                        runtime,
                        group,
                        tick,
                        idleDirectionXs,
                        idleDirectionYs,
                        idleDirectionZs,
                        directionXs,
                        directionYs,
                        directionZs,
                        row,
                        tangentX / length,
                        tangentY / length,
                        tangentZ / length,
                    );
                    continue;
                }
                writeTransitionDirection(
                    runtime,
                    group,
                    tick,
                    idleDirectionXs,
                    idleDirectionYs,
                    idleDirectionZs,
                    directionXs,
                    directionYs,
                    directionZs,
                    row,
                    0,
                    1,
                    0,
                );
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
            writeTransitionDirection(
                runtime,
                group,
                tick,
                idleDirectionXs,
                idleDirectionYs,
                idleDirectionZs,
                directionXs,
                directionYs,
                directionZs,
                row,
                rightX * horizontal,
                upward,
                rightZ * horizontal,
            );
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
        runtime.formationPlans[index] =
            runtime.formationPlans[last];
        runtime.modes[index] = runtime.modes[last];
        runtime.stances[index] = runtime.stances[last];
        runtime.activeFormations[index] =
            runtime.activeFormations[last];
        runtime.activeForwardXs[index] =
            runtime.activeForwardXs[last];
        runtime.activeForwardZs[index] =
            runtime.activeForwardZs[last];
        runtime.transitionStartTicks[index] =
            runtime.transitionStartTicks[last];
        runtime.marks[index] = runtime.marks[last];
        runtime.indices.set(moved, index);
    }
    runtime.count = last;
}

function markFormationTransition(
    runtime: Mut<FlyingSwordGroupIndexState>,
    group: Entity,
    tick: number,
): void {
    const index = runtime.indices.get(group);
    if (index !== undefined) {
        runtime.transitionStartTicks[index] = tick;
    }
}

function writeFusionSlot(
    slot: number,
    formationSize: number,
    elapsed: number,
    out: {
        longitudinal: number;
        radius: number;
        angle: number;
        tip: boolean;
    },
): void {
    const size = Math.max(1, formationSize);
    const normalizedSlot = slot % size;
    const spin = elapsed * FUSION_SPIRAL_SPEED;
    if (size === 1 || normalizedSlot === size - 1) {
        out.longitudinal = FUSION_UMBRELLA_APEX;
        out.radius = 0;
        out.angle = spin;
        out.tip = true;
        return;
    }

    const bodyCount = size - 1;
    const layer = Math.ceil(
        (
            Math.sqrt(
                1 +
                4 * (normalizedSlot + 1) /
                    FUSION_UMBRELLA_CUMULATIVE_LAYER_FACTOR,
            ) - 1
        ) * 0.5,
    );
    const layerCount = Math.ceil(
        (
            Math.sqrt(
                1 +
                4 * bodyCount /
                    FUSION_UMBRELLA_CUMULATIVE_LAYER_FACTOR,
            ) - 1
        ) * 0.5,
    );
    const previousLayerCount =
        FUSION_UMBRELLA_CUMULATIVE_LAYER_FACTOR *
        (layer - 1) * layer;
    const layerCapacity =
        FUSION_UMBRELLA_BASE_LAYER_SIZE * layer;
    const layerSize = Math.min(
        layerCapacity,
        bodyCount - previousLayerCount,
    );
    const blade = normalizedSlot - previousLayerCount;
    const progress = layer / layerCount;
    out.longitudinal =
        FUSION_UMBRELLA_APEX -
        FUSION_UMBRELLA_DEPTH * Math.pow(
            progress,
            FUSION_UMBRELLA_DEPTH_EXPONENT,
        );
    out.radius =
        FUSION_UMBRELLA_RADIUS *
        Math.sin(progress * Math.PI * 0.5);
    out.angle =
        spin +
        blade * Math.PI * 2 / layerSize +
        (layer - 1) * FUSION_UMBRELLA_LAYER_TWIST;
    out.tip = false;
}

function writeFormationGoal(
    runtime: Readonly<FlyingSwordGroupIndexState>,
    group: number,
    tick: number,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    row: number,
    goalX: number,
    goalY: number,
    goalZ: number,
): void {
    const transitionTick =
        tick - runtime.transitionStartTicks[group];
    if (transitionTick >= FORMATION_TRANSITION_TICKS) {
        xs[row] = goalX;
        ys[row] = goalY;
        zs[row] = goalZ;
        return;
    }
    const progress = Math.max(
        0,
        Math.min(
            1,
            (transitionTick + 1) / FORMATION_TRANSITION_TICKS,
        ),
    );
    const weight =
        progress * progress * (3 - progress * 2);
    xs[row] += (goalX - xs[row]) * weight;
    ys[row] += (goalY - ys[row]) * weight;
    zs[row] += (goalZ - zs[row]) * weight;
}

function writeTransitionDirection(
    runtime: Readonly<FlyingSwordGroupIndexState>,
    group: number,
    tick: number,
    previousXs: Float32Array,
    previousYs: Float32Array,
    previousZs: Float32Array,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    row: number,
    targetX: number,
    targetY: number,
    targetZ: number,
): void {
    const transitionTick =
        tick - runtime.transitionStartTicks[group];
    let weight = 1;
    if (transitionTick < FORMATION_TRANSITION_TICKS) {
        const progress = Math.max(
            0,
            Math.min(
                1,
                (transitionTick + 1) / FORMATION_TRANSITION_TICKS,
            ),
        );
        weight = progress * progress * (3 - progress * 2);
    }
    const x =
        previousXs[row] +
        (targetX - previousXs[row]) * weight;
    const y =
        previousYs[row] +
        (targetY - previousYs[row]) * weight;
    const z =
        previousZs[row] +
        (targetZ - previousZs[row]) * weight;
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length <= DIRECTION_EPSILON) return;
    const inverse = 1 / length;
    const resultX = x * inverse;
    const resultY = y * inverse;
    const resultZ = z * inverse;
    previousXs[row] = resultX;
    previousYs[row] = resultY;
    previousZs[row] = resultZ;
    xs[row] = resultX;
    ys[row] = resultY;
    zs[row] = resultZ;
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
const FORMATION_GUIDANCE_LOOKAHEAD_SECONDS = 0.1;
const FORMATION_HEIGHT_MULTIPLIER = 0.76;
const FORMATION_TRANSITION_TICKS = 18;
const FUSION_SPIRAL_SPEED = 18;
const FUSION_SPIRAL_AXIS_HEIGHT = 0.92;
const FUSION_UMBRELLA_APEX = 4.8;
const FUSION_UMBRELLA_DEPTH = 2.5;
const FUSION_UMBRELLA_DEPTH_EXPONENT = 0.75;
const FUSION_UMBRELLA_RADIUS = 1.55;
const FUSION_UMBRELLA_BASE_LAYER_SIZE = 6;
const FUSION_UMBRELLA_CUMULATIVE_LAYER_FACTOR =
    FUSION_UMBRELLA_BASE_LAYER_SIZE * 0.5;
const FUSION_UMBRELLA_LAYER_TWIST = Math.PI / 9;
const FUSION_UMBRELLA_TANGENT_WEIGHT = 0.28;
const formationSlotSample: FlyingSwordFormationSlotSample = {
    route: 0,
    routeSlot: 0,
    routeSwordCount: 1,
    phaseOffset: 0,
};
const formationRouteSample: FlyingSwordFormationRouteSample = {
    x: 0,
    y: 0,
    z: 0,
    tangentX: 0,
    tangentY: 0,
    tangentZ: 1,
};
const fusionSlotPoint = {
    longitudinal: 0,
    radius: 0,
    angle: 0,
    tip: false,
};
