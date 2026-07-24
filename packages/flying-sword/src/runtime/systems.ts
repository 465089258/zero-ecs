import {
    Update,
    Write,
    defSystem,
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

type Groups = QueryOf<typeof FlyingSwordGroupStorageQuery>;
type Swords = QueryOf<typeof FlyingSwordBaseStorageQuery>;

export const applyFlyingSwordRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordRequests,
    [Write(FlyingSwordRequestState), FlyingSwordGroupStorageQuery],
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
                    data[FlyingSwordGroupField.Mode][row] =
                        requests.modes[request];
                } else if (
                    kind === FlyingSwordRequestKind.SetTargetPoint
                ) {
                    data[FlyingSwordGroupField.TargetX][row] =
                        requests.xs[request];
                    data[FlyingSwordGroupField.TargetY][row] =
                        requests.ys[request];
                    data[FlyingSwordGroupField.TargetZ][row] =
                        requests.zs[request];
                } else if (kind === FlyingSwordRequestKind.SetCenter) {
                    data[FlyingSwordGroupField.CenterX][row] =
                        requests.xs[request];
                    data[FlyingSwordGroupField.CenterY][row] =
                        requests.ys[request];
                    data[FlyingSwordGroupField.CenterZ][row] =
                        requests.zs[request];
                }
                data[FlyingSwordGroupField.Revision][row]++;
            }
        }
    }
    requests.clear();
}

function snapshotFlyingSwordGroups(
    time: Readonly<TimeState>,
    runtime: Mut<FlyingSwordRuntimeState>,
    groups: Groups,
): void {
    const iter = groups.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const centerXs = data[FlyingSwordGroupField.CenterX];
        const centerYs = data[FlyingSwordGroupField.CenterY];
        const centerZs = data[FlyingSwordGroupField.CenterZ];
        for (let row = 0; row < count; row++) {
            const snapshot = runtime.snapshot(entities[row]);
            snapshot.tick = time.tick;
            snapshot.centerX = centerXs[row];
            snapshot.centerY = centerYs[row];
            snapshot.centerZ = centerZs[row];
            snapshot.targetX = data[FlyingSwordGroupField.TargetX][row];
            snapshot.targetY = data[FlyingSwordGroupField.TargetY][row];
            snapshot.targetZ = data[FlyingSwordGroupField.TargetZ][row];
            snapshot.orbitRadius =
                data[FlyingSwordGroupField.OrbitRadius][row];
            snapshot.orbitHeight =
                data[FlyingSwordGroupField.OrbitHeight][row];
            snapshot.angularSpeed =
                data[FlyingSwordGroupField.AngularSpeed][row];
            snapshot.verticalAmplitude =
                data[FlyingSwordGroupField.VerticalAmplitude][row];
            snapshot.verticalSpeed =
                data[FlyingSwordGroupField.VerticalSpeed][row];
            snapshot.formationSize = Math.max(
                1,
                data[FlyingSwordGroupField.FormationSize][row],
            );
            snapshot.mode =
                data[FlyingSwordGroupField.Mode][row] as FlyingSwordMode;
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
        const [count, , members, , , , , , formationGoals] =
            iter.current;
        const groups = members[FlyingSwordMember.Group];
        const slots = members[FlyingSwordMember.Slot];
        const formationGoalXs = formationGoals[Float3.X];
        const formationGoalYs = formationGoals[Float3.Y];
        const formationGoalZs = formationGoals[Float3.Z];

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

            const slotPhase =
                slot * Math.PI * 2 / snapshot.formationSize;
            const verticalPhase =
                time.elapsed * snapshot.verticalSpeed + slotPhase;
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
