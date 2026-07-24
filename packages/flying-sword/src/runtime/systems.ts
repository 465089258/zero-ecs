import {
    Update,
    World,
    Write,
    defSystem,
    type ComponentColumns,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import { Float3 } from "@zero-ecs/math/3d";
import { FlyingSwordSystemSet } from "../system-set";
import {
    FlyingSwordGroupField,
    FlyingSwordMember,
    FlyingSwordMode,
} from "../types";
import {
    FlyingSwordRequestKind,
    FlyingSwordRequestState,
} from "./request-state";
import {
    FlyingSwordBaseStorageQuery,
    FlyingSwordGroupStorageQuery,
} from "./queries";
import { FlyingSwordRuntimeState } from "./runtime-state";
import { FlyingSwordGroupStorage } from "./storage";

type Groups = QueryOf<typeof FlyingSwordGroupStorageQuery>;
type Swords = QueryOf<typeof FlyingSwordBaseStorageQuery>;

export const applyFlyingSwordRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordRequests,
    [World, Write(FlyingSwordRequestState)],
);

export const snapshotFlyingSwordGroupsSystem = defSystem(
    Update.fixed,
    snapshotFlyingSwordGroups,
    [
        TimeState,
        Write(FlyingSwordRuntimeState),
        FlyingSwordGroupStorageQuery,
    ],
);

export const formFlyingSwordGoalsSystem = defSystem(
    Update.fixed,
    formFlyingSwordGoals,
    [TimeState, FlyingSwordRuntimeState, FlyingSwordBaseStorageQuery],
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
});

function applyFlyingSwordRequests(
    world: World,
    requests: Mut<FlyingSwordRequestState>,
): void {
    const requestCount = requests.count;
    if (requestCount === 0) return;

    const component = world.findComponent(FlyingSwordGroupStorage);
    if (!component) {
        requests.clear();
        return;
    }

    const kinds = requests.kinds;
    const groups = requests.groups;
    const xs = requests.xs;
    const ys = requests.ys;
    const zs = requests.zs;
    const modes = requests.modes;
    const access = requests.access;
    const componentId = component.id;

    for (let request = 0; request < requestCount; request++) {
        if (!world.resolve(groups[request], access)) continue;
        const archetype = access.archetype;
        if (!archetype) continue;
        const data = archetype.getComp(access.row, componentId) as
            ComponentColumns<FlyingSwordGroupStorage> | null;
        if (!data) continue;

        const row = archetype.rowIdxOf(access.row);
        const kind = kinds[request];
        if (kind === FlyingSwordRequestKind.SetMode) {
            const groupModes = data[FlyingSwordGroupField.Mode];
            groupModes[row] = modes[request];
        } else if (kind === FlyingSwordRequestKind.SetTargetPoint) {
            const targetXs = data[FlyingSwordGroupField.TargetX];
            const targetYs = data[FlyingSwordGroupField.TargetY];
            const targetZs = data[FlyingSwordGroupField.TargetZ];
            targetXs[row] = xs[request];
            targetYs[row] = ys[request];
            targetZs[row] = zs[request];
        } else if (kind === FlyingSwordRequestKind.SetCenter) {
            const centerXs = data[FlyingSwordGroupField.CenterX];
            const centerYs = data[FlyingSwordGroupField.CenterY];
            const centerZs = data[FlyingSwordGroupField.CenterZ];
            centerXs[row] = xs[request];
            centerYs[row] = ys[request];
            centerZs[row] = zs[request];
        }
        const revisions = data[FlyingSwordGroupField.Revision];
        revisions[row]++;
    }
    requests.clear();
}

function snapshotFlyingSwordGroups(
    time: Readonly<TimeState>,
    runtime: Mut<FlyingSwordRuntimeState>,
    groups: Groups,
): void {
    const tick = time.tick;
    const iter = groups.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const centerXs = data[FlyingSwordGroupField.CenterX];
        const centerYs = data[FlyingSwordGroupField.CenterY];
        const centerZs = data[FlyingSwordGroupField.CenterZ];
        const targetXs = data[FlyingSwordGroupField.TargetX];
        const targetYs = data[FlyingSwordGroupField.TargetY];
        const targetZs = data[FlyingSwordGroupField.TargetZ];
        const orbitRadii = data[FlyingSwordGroupField.OrbitRadius];
        const orbitHeights = data[FlyingSwordGroupField.OrbitHeight];
        const angularSpeeds = data[FlyingSwordGroupField.AngularSpeed];
        const verticalAmplitudes =
            data[FlyingSwordGroupField.VerticalAmplitude];
        const verticalSpeeds =
            data[FlyingSwordGroupField.VerticalSpeed];
        const formationSizes =
            data[FlyingSwordGroupField.FormationSize];
        const modes = data[FlyingSwordGroupField.Mode];
        for (let row = 0; row < count; row++) {
            const snapshot = runtime.snapshot(entities[row]);
            snapshot.tick = tick;
            snapshot.centerX = centerXs[row];
            snapshot.centerY = centerYs[row];
            snapshot.centerZ = centerZs[row];
            snapshot.targetX = targetXs[row];
            snapshot.targetY = targetYs[row];
            snapshot.targetZ = targetZs[row];
            snapshot.orbitRadius = orbitRadii[row];
            snapshot.orbitHeight = orbitHeights[row];
            snapshot.angularSpeed = angularSpeeds[row];
            snapshot.verticalAmplitude = verticalAmplitudes[row];
            snapshot.verticalSpeed = verticalSpeeds[row];
            snapshot.formationSize = Math.max(1, formationSizes[row]);
            snapshot.mode = modes[row] as FlyingSwordMode;
        }
    }
    runtime.removeStale(tick);
}

function formFlyingSwordGoals(
    time: Readonly<TimeState>,
    runtime: Readonly<FlyingSwordRuntimeState>,
    swords: Swords,
): void {
    const tick = time.tick;
    const elapsed = time.elapsed;
    const snapshots = runtime.groups;
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
            const snapshot = snapshots.get(groups[row]);
            if (!snapshot || snapshot.tick !== tick) continue;

            const slot = slots[row];
            const phase = elapsed * snapshot.angularSpeed +
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

            const slotPhase =
                slot * Math.PI * 2 / snapshot.formationSize;
            const verticalPhase =
                elapsed * snapshot.verticalSpeed + slotPhase;
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
