import {
    Commands,
    Startup,
    SystemSet,
    Update,
    Write,
    defSystem,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    FlyingSwordField,
    FlyingSwordMode,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordSystemSet,
} from "@zero-ecs/flying-sword";
import { DemoRenderService } from "../presentation/render-service";
import {
    CultivatorMovementField,
    CultivatorMovementQuery,
    CultivatorMovementType,
    CultivatorQuery,
    CultivatorTag,
    Transform3Field,
    Transform3Type,
} from "./components";
import {
    DemoInputAction,
    DemoInputService,
    type DemoInputOut,
} from "./input-service";
import { DemoSceneState } from "./state";

type Cultivators = QueryOf<typeof CultivatorQuery>;
type MovingCultivators = QueryOf<typeof CultivatorMovementQuery>;
type FlyingSwords = QueryOf<typeof FlyingSwordQuery>;

export const setupFlyingSwordDemoSystem = defSystem(
    Startup,
    setupFlyingSwordDemo,
    [Commands, FlyingSwordService, Write(DemoSceneState)],
);

export const consumeFlyingSwordInputSystem = defSystem(
    Update.fixed,
    consumeFlyingSwordInput,
    [
        DemoInputService,
        DemoRenderService,
        FlyingSwordService,
        Write(DemoSceneState),
        CultivatorMovementQuery,
    ],
);

export const moveCultivatorsSystem = defSystem(
    Update.fixed,
    moveCultivators,
    [TimeState, CultivatorMovementQuery, Write(DemoSceneState)],
);

export const resolveFlyingSwordCommandSystem = defSystem(
    Update.fixed,
    resolveFlyingSwordCommand,
    [
        FlyingSwordService,
        Write(DemoSceneState),
        CultivatorQuery,
        FlyingSwordQuery,
    ],
);

const DemoSimulationSystemSet = Object.freeze({
    Input: new SystemSet(Update.fixed, "flying-sword-demo:input"),
    CultivatorMovement: new SystemSet(
        Update.fixed,
        "flying-sword-demo:cultivator-movement",
    ),
    SwordCommand: new SystemSet(
        Update.fixed,
        "flying-sword-demo:sword-command",
    ),
});

export const DemoInputSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.Input,
    before: FlyingSwordSystemSet.Request,
});

export const DemoCultivatorMovementSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.CultivatorMovement,
    after: DemoSimulationSystemSet.Input,
    before: FlyingSwordSystemSet.Control,
});

export const DemoSwordCommandSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.SwordCommand,
    after: FlyingSwordSystemSet.Motion,
});

function setupFlyingSwordDemo(
    commands: Commands,
    flyingSwords: FlyingSwordService,
    scene: Mut<DemoSceneState>,
): void {
    const cultivatorCommand = commands.spawn();
    const cultivator = cultivatorCommand.entity;
    cultivatorCommand
        .add(Transform3Type)
        .add(CultivatorMovementType)
        .add(CultivatorTag)
        .set(Transform3Type, Transform3Field.X, 0)
        .set(Transform3Type, Transform3Field.Y, 0)
        .set(Transform3Type, Transform3Field.Z, 0)
        .set(Transform3Type, Transform3Field.PreviousX, 0)
        .set(Transform3Type, Transform3Field.PreviousY, 0)
        .set(Transform3Type, Transform3Field.PreviousZ, 0)
        .set(CultivatorMovementType, CultivatorMovementField.TargetX, 0)
        .set(CultivatorMovementType, CultivatorMovementField.TargetZ, 0)
        .set(CultivatorMovementType, CultivatorMovementField.Speed, 5.4)
        .set(
            CultivatorMovementType,
            CultivatorMovementField.StoppingDistance,
            0.04,
        )
        .set(CultivatorMovementType, CultivatorMovementField.Moving, 0)
        .submit();
    const flyingSwordCount = readFlyingSwordCount();
    const group = flyingSwords.createGroup({
        owner: cultivator,
        center: { x: 0, y: 0, z: 0 },
        formationSize: flyingSwordCount,
        orbitRadius: 3.15,
        orbitHeight: 1.35,
        angularSpeed: 0.72,
        verticalAmplitude: 0.35,
        verticalSpeed: 2.7,
    });
    for (let slot = 0; slot < flyingSwordCount; slot++) {
        flyingSwords.createSword({
            group,
            position: {
                x: (slot - 3) * 0.16,
                y: 0.7 + slot * 0.08,
                z: -0.9,
            },
            slot,
            visualId: slot,
            maximumSpeed: 13,
            acceleration: 42,
        });
    }

    scene.cultivator = cultivator;
    scene.swordGroup = group;
}

function readFlyingSwordCount(): number {
    const raw = new URLSearchParams(window.location.search).get("swords");
    if (raw === null) return DEFAULT_FLYING_SWORD_COUNT;
    const count = Number(raw);
    return Number.isSafeInteger(count) && count >= 1 && count <= MAX_FLYING_SWORD_COUNT
        ? count
        : DEFAULT_FLYING_SWORD_COUNT;
}

const input: DemoInputOut = {
    action: DemoInputAction.None,
    clientX: 0,
    clientY: 0,
};
const target = { x: 0, y: 0, z: 0 };
const DEFAULT_FLYING_SWORD_COUNT = 81;
const MAX_FLYING_SWORD_COUNT = 2000;

function consumeFlyingSwordInput(
    inputService: DemoInputService,
    renderer: DemoRenderService,
    flyingSwords: FlyingSwordService,
    scene: Mut<DemoSceneState>,
    cultivators: MovingCultivators,
): void {
    if (!inputService.consume(input)) return;
    if (input.action === DemoInputAction.Move) {
        if (!renderer.clientToGround(input.clientX, input.clientY, target)) return;
        if (!setCultivatorDestination(
            cultivators,
            scene.cultivator,
            target.x,
            target.z,
        )) {
            return;
        }
        scene.moveTargetX = target.x;
        scene.moveTargetY = target.y;
        scene.moveTargetZ = target.z;
        scene.hasMoveTarget = true;
    } else if (input.action === DemoInputAction.Focus) {
        if (!renderer.clientToGround(input.clientX, input.clientY, target)) return;
        flyingSwords.focus(scene.swordGroup, target);
        scene.targetX = target.x;
        scene.targetY = target.y;
        scene.targetZ = target.z;
        scene.mode = FlyingSwordMode.Focus;
    } else if (input.action === DemoInputAction.Orbit) {
        flyingSwords.orbit(scene.swordGroup);
        scene.mode = FlyingSwordMode.Orbit;
    } else if (input.action === DemoInputAction.Recall) {
        flyingSwords.recall(scene.swordGroup);
        scene.mode = FlyingSwordMode.Recall;
    }
}

function setCultivatorDestination(
    cultivators: MovingCultivators,
    entity: number,
    x: number,
    z: number,
): boolean {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, , movements] = iter.current;
        const targetXs = movements[CultivatorMovementField.TargetX];
        const targetZs = movements[CultivatorMovementField.TargetZ];
        const moving = movements[CultivatorMovementField.Moving];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== entity) continue;
            targetXs[row] = x;
            targetZs[row] = z;
            moving[row] = 1;
            return true;
        }
    }
    return false;
}

function moveCultivators(
    time: Readonly<TimeState>,
    cultivators: MovingCultivators,
    scene: Mut<DemoSceneState>,
): void {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, transforms, movements] = iter.current;
        const xs = transforms[Transform3Field.X];
        const ys = transforms[Transform3Field.Y];
        const zs = transforms[Transform3Field.Z];
        const previousXs = transforms[Transform3Field.PreviousX];
        const previousYs = transforms[Transform3Field.PreviousY];
        const previousZs = transforms[Transform3Field.PreviousZ];
        const targetXs = movements[CultivatorMovementField.TargetX];
        const targetZs = movements[CultivatorMovementField.TargetZ];
        const speeds = movements[CultivatorMovementField.Speed];
        const stoppingDistances =
            movements[CultivatorMovementField.StoppingDistance];
        const moving = movements[CultivatorMovementField.Moving];
        for (let row = 0; row < count; row++) {
            const x = xs[row];
            const y = ys[row];
            const z = zs[row];
            previousXs[row] = x;
            previousYs[row] = y;
            previousZs[row] = z;
            if (moving[row] === 0) continue;

            const dx = targetXs[row] - x;
            const dz = targetZs[row] - z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            const maximumStep = speeds[row] * time.delta;
            if (
                distance <= stoppingDistances[row] ||
                distance <= maximumStep
            ) {
                xs[row] = targetXs[row];
                zs[row] = targetZs[row];
                moving[row] = 0;
                if (entities[row] === scene.cultivator) {
                    scene.hasMoveTarget = false;
                }
                continue;
            }

            const scale = maximumStep / distance;
            xs[row] = x + dx * scale;
            zs[row] = z + dz * scale;
        }
    }
}

function resolveFlyingSwordCommand(
    flyingSwords: FlyingSwordService,
    scene: Mut<DemoSceneState>,
    cultivators: Cultivators,
    swords: FlyingSwords,
): void {
    if (scene.mode === FlyingSwordMode.Orbit) return;

    let centerX = 0;
    let centerZ = 0;
    if (scene.mode === FlyingSwordMode.Recall) {
        const center = findCultivatorPosition(cultivators, scene.cultivator);
        if (!center) return;
        centerX = center.x;
        centerZ = center.z;
    }

    const targetX = scene.mode === FlyingSwordMode.Focus
        ? scene.targetX
        : centerX;
    const targetZ = scene.mode === FlyingSwordMode.Focus
        ? scene.targetZ
        : centerZ;
    const arrivalRadius = scene.mode === FlyingSwordMode.Focus
        ? FOCUS_ARRIVAL_RADIUS
        : RECALL_ARRIVAL_RADIUS;
    const arrivalRadiusSquared = arrivalRadius * arrivalRadius;
    let total = 0;
    let arrived = 0;
    const iter = swords.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        const groups = data[FlyingSwordField.Group];
        const xs = data[FlyingSwordField.X];
        const zs = data[FlyingSwordField.Z];
        for (let row = 0; row < count; row++) {
            if (groups[row] !== scene.swordGroup) continue;
            total++;
            const dx = xs[row] - targetX;
            const dz = zs[row] - targetZ;
            if (dx * dx + dz * dz <= arrivalRadiusSquared) arrived++;
        }
    }
    if (total === 0 || arrived / total < ARRIVAL_RATIO) return;

    if (scene.mode === FlyingSwordMode.Focus) {
        flyingSwords.recall(scene.swordGroup);
        scene.mode = FlyingSwordMode.Recall;
    } else {
        flyingSwords.orbit(scene.swordGroup);
        scene.mode = FlyingSwordMode.Orbit;
    }
}

const cultivatorPosition = { x: 0, z: 0 };

function findCultivatorPosition(
    cultivators: Cultivators,
    entity: number,
): typeof cultivatorPosition | null {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, transforms] = iter.current;
        const xs = transforms[Transform3Field.X];
        const zs = transforms[Transform3Field.Z];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== entity) continue;
            cultivatorPosition.x = xs[row];
            cultivatorPosition.z = zs[row];
            return cultivatorPosition;
        }
    }
    return null;
}

const FOCUS_ARRIVAL_RADIUS = 1.55;
const RECALL_ARRIVAL_RADIUS = 1.45;
const ARRIVAL_RATIO = 0.8;
