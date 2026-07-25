import {
    defSystem,
} from "@zero-ecs/game";
import { DamageDisplayQuery } from "../damage-display/queries";
import { DemoSceneState } from "../simulation/state";
import {
    RogueEnemyRenderQuery,
    RogueExperiencePickupQuery,
    RoguePlayerQuery,
    RogueRunQuery,
} from "../simulation/rogue/queries";
import {
    DemoRenderFrameState,
} from "./render-frame";
import { DemoRenderService } from "./render-service";
import { DemoFlyingSwordRenderQuery } from "./queries";
import {
    FlyingSwordRender,
    FlyingSwordRenderSet,
} from "./render-stage";

export const renderFlyingSwordDemoSystem = defSystem(
    FlyingSwordRender,
    renderFlyingSwordDemo,
    [
        DemoRenderService,
        DemoRenderFrameState,
        DemoSceneState,
        RogueRunQuery,
        RoguePlayerQuery,
        RogueEnemyRenderQuery,
        RogueExperiencePickupQuery,
        DamageDisplayQuery,
        DemoFlyingSwordRenderQuery,
    ],
);

export const DemoRenderSystemOptions = Object.freeze({
    inSet: FlyingSwordRenderSet.World,
});

function renderFlyingSwordDemo(
    renderer: DemoRenderService,
    frame: Readonly<DemoRenderFrameState>,
    scene: Readonly<DemoSceneState>,
    runs: Parameters<DemoRenderService["render"]>[2],
    cultivators: Parameters<DemoRenderService["render"]>[3],
    enemies: Parameters<DemoRenderService["render"]>[4],
    pickups: Parameters<DemoRenderService["render"]>[5],
    damages: Parameters<DemoRenderService["render"]>[6],
    swords: Parameters<DemoRenderService["render"]>[7],
): void {
    renderer.render(
        frame.interpolation,
        scene,
        runs,
        cultivators,
        enemies,
        pickups,
        damages,
        swords,
    );
}
