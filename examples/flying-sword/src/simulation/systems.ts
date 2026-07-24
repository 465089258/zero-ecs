import {
    Commands,
    Startup,
    Update,
    Write,
    defSystem,
    type Mut,
} from "@zero-ecs/game";
import {
    FlyingSwordMode,
    FlyingSwordService,
    FlyingSwordSystemSet,
} from "@zero-ecs/flying-sword";
import { DemoRenderService } from "../presentation/render-service";
import {
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
    ],
);

export const DemoInputSystemOptions = Object.freeze({
    before: FlyingSwordSystemSet.Request,
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
        .add(CultivatorTag)
        .set(Transform3Type, Transform3Field.X, 0)
        .set(Transform3Type, Transform3Field.Y, 0)
        .set(Transform3Type, Transform3Field.Z, 0)
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
): void {
    if (!inputService.consume(input)) return;
    if (input.action === DemoInputAction.Focus) {
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
