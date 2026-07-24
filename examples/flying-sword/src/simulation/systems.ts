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
import {
    Direction3Type,
    Float3,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
} from "@zero-ecs/math/3d";
import {
    MotionSystemSet,
    MoveTowards3,
    MoveTowards3Type,
} from "@zero-ecs/motion/3d";
import {
    FlyingSwordMode,
    FlyingSwordService,
    FlyingSwordSkillService,
    FlyingSwordSystemSet,
} from "@zero-ecs/flying-sword";
import {
    FlyingSwordVisual,
    FlyingSwordVisualType,
} from "../content/components";
import { DemoRenderService } from "../presentation/render-service";
import {
    CultivatorControlQuery,
    CultivatorMoveActiveTag,
    CultivatorTag,
    MovingCultivatorQuery,
} from "./components";
import {
    DemoInputAction,
    DemoInputService,
    type DemoInputOut,
} from "./input-service";
import { DemoSceneState } from "./state";

type Cultivators = QueryOf<typeof CultivatorControlQuery>;
type MovingCultivators = QueryOf<typeof MovingCultivatorQuery>;

export const setupFlyingSwordDemoSystem = defSystem(
    Startup,
    setupFlyingSwordDemo,
    [Commands, FlyingSwordService, Write(DemoSceneState)],
);

export const consumeFlyingSwordInputSystem = defSystem(
    Update.fixed,
    consumeFlyingSwordInput,
    [
        Commands,
        DemoInputService,
        DemoRenderService,
        FlyingSwordService,
        FlyingSwordSkillService,
        Write(DemoSceneState),
        CultivatorControlQuery,
    ],
);

export const synchronizeFlyingSwordGroupCenterSystem = defSystem(
    Update.fixed,
    synchronizeFlyingSwordGroupCenter,
    [
        FlyingSwordService,
        DemoSceneState,
        CultivatorControlQuery,
    ],
);

export const resolveCultivatorMovementSystem = defSystem(
    Update.fixed,
    resolveCultivatorMovement,
    [Commands, MovingCultivatorQuery, Write(DemoSceneState)],
);

const DemoSimulationSystemSet = Object.freeze({
    Input: new SystemSet(Update.fixed, "flying-sword-demo:input"),
    GroupCenter: new SystemSet(
        Update.fixed,
        "flying-sword-demo:group-center",
    ),
    MovementResult: new SystemSet(
        Update.fixed,
        "flying-sword-demo:movement-result",
    ),
});

export const DemoInputSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.Input,
    before: FlyingSwordSystemSet.Request,
});

export const DemoGroupCenterSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.GroupCenter,
    after: DemoSimulationSystemSet.Input,
    before: FlyingSwordSystemSet.Request,
});

export const DemoMovementResultSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.MovementResult,
    after: MotionSystemSet.Integrate3,
});

function setupFlyingSwordDemo(
    commands: Commands,
    flyingSwords: FlyingSwordService,
    scene: Mut<DemoSceneState>,
): void {
    const cultivatorCommand = commands.spawn();
    const cultivator = cultivatorCommand.entity;
    cultivatorCommand
        .add(Position3Type)
        .add(PreviousPosition3Type)
        .add(Velocity3Type)
        .add(Direction3Type)
        .add(MoveTowards3Type)
        .add(CultivatorTag)
        .set(Position3Type, Float3.X, 0)
        .set(Position3Type, Float3.Y, 0)
        .set(Position3Type, Float3.Z, 0)
        .set(PreviousPosition3Type, Float3.X, 0)
        .set(PreviousPosition3Type, Float3.Y, 0)
        .set(PreviousPosition3Type, Float3.Z, 0)
        .set(Velocity3Type, Float3.X, 0)
        .set(Velocity3Type, Float3.Y, 0)
        .set(Velocity3Type, Float3.Z, 0)
        .set(Direction3Type, Float3.X, 0)
        .set(Direction3Type, Float3.Y, 0)
        .set(Direction3Type, Float3.Z, 1)
        .set(MoveTowards3Type, MoveTowards3.TargetX, 0)
        .set(MoveTowards3Type, MoveTowards3.TargetY, 0)
        .set(MoveTowards3Type, MoveTowards3.TargetZ, 0)
        .set(MoveTowards3Type, MoveTowards3.MaximumSpeed, 5.4)
        .set(MoveTowards3Type, MoveTowards3.Acceleration, 48)
        .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0.04)
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
        const sword = flyingSwords.createSword({
            group,
            position: {
                x: (slot - 3) * 0.16,
                y: 0.7 + slot * 0.08,
                z: -0.9,
            },
            slot,
            maximumSpeed: 13,
            acceleration: 42,
        });
        commands
            .entity(sword)
            .add(FlyingSwordVisualType)
            .set(FlyingSwordVisualType, FlyingSwordVisual.Id, slot)
            .submit();
    }

    scene.cultivator = cultivator;
    scene.swordGroup = group;
}

function readFlyingSwordCount(): number {
    const raw =
        new URLSearchParams(window.location.search).get("swords");
    if (raw === null) return DEFAULT_FLYING_SWORD_COUNT;
    const count = Number(raw);
    return (
        Number.isSafeInteger(count) &&
        count >= 1 &&
        count <= MAX_FLYING_SWORD_COUNT
    )
        ? count
        : DEFAULT_FLYING_SWORD_COUNT;
}

const input: DemoInputOut = {
    action: DemoInputAction.None,
    clientX: 0,
    clientY: 0,
};
const target = { x: 0, y: 0, z: 0 };
const groupCenter = { x: 0, y: 0, z: 0 };
const DEFAULT_FLYING_SWORD_COUNT = 81;
const MAX_FLYING_SWORD_COUNT = 2000;

function consumeFlyingSwordInput(
    commands: Commands,
    inputService: DemoInputService,
    renderer: DemoRenderService,
    flyingSwords: FlyingSwordService,
    skills: FlyingSwordSkillService,
    scene: Mut<DemoSceneState>,
    cultivators: Cultivators,
): void {
    if (!inputService.consume(input)) return;
    if (input.action === DemoInputAction.Move) {
        if (
            !renderer.clientToGround(
                input.clientX,
                input.clientY,
                target,
            )
        ) {
            return;
        }
        if (
            !setCultivatorDestination(
                commands,
                cultivators,
                scene.cultivator,
                target.x,
                target.z,
            )
        ) {
            return;
        }
        scene.moveTargetX = target.x;
        scene.moveTargetY = target.y;
        scene.moveTargetZ = target.z;
        scene.hasMoveTarget = true;
    } else if (input.action === DemoInputAction.Focus) {
        if (
            !renderer.clientToGround(
                input.clientX,
                input.clientY,
                target,
            )
        ) {
            return;
        }
        flyingSwords.orbit(scene.swordGroup);
        skills.cast({
            group: scene.swordGroup,
            target,
        });
        scene.targetX = target.x;
        scene.targetY = target.y;
        scene.targetZ = target.z;
        scene.mode = FlyingSwordMode.Orbit;
    } else if (input.action === DemoInputAction.Orbit) {
        skills.cancel(scene.swordGroup);
        flyingSwords.orbit(scene.swordGroup);
        scene.mode = FlyingSwordMode.Orbit;
    } else if (input.action === DemoInputAction.Recall) {
        skills.cancel(scene.swordGroup);
        flyingSwords.recall(scene.swordGroup);
        scene.mode = FlyingSwordMode.Recall;
    }
}

function setCultivatorDestination(
    commands: Commands,
    cultivators: Cultivators,
    entity: number,
    x: number,
    z: number,
): boolean {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions, motion] = iter.current;
        const ys = positions[Float3.Y];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== entity) continue;
            targetXs[row] = x;
            targetYs[row] = ys[row];
            targetZs[row] = z;
            commands
                .entity(entities[row])
                .add(CultivatorMoveActiveTag)
                .submit();
            return true;
        }
    }
    return false;
}

function synchronizeFlyingSwordGroupCenter(
    flyingSwords: FlyingSwordService,
    scene: Readonly<DemoSceneState>,
    cultivators: Cultivators,
): void {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== scene.cultivator) continue;
            groupCenter.x = xs[row];
            groupCenter.y = ys[row];
            groupCenter.z = zs[row];
            flyingSwords.setCenter(scene.swordGroup, groupCenter);
            return;
        }
    }
}

function resolveCultivatorMovement(
    commands: Commands,
    cultivators: MovingCultivators,
    scene: Mut<DemoSceneState>,
): void {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions, motion] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];
        for (let row = 0; row < count; row++) {
            const dx = targetXs[row] - xs[row];
            const dy = targetYs[row] - ys[row];
            const dz = targetZs[row] - zs[row];
            const radius = arrivalRadii[row];
            if (dx * dx + dy * dy + dz * dz > radius * radius) {
                continue;
            }
            commands
                .entity(entities[row])
                .remove(CultivatorMoveActiveTag)
                .submit();
            if (entities[row] === scene.cultivator) {
                scene.hasMoveTarget = false;
            }
        }
    }
}
