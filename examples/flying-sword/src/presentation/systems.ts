import {
    FlyingSwordGroupQuery,
} from "@zero-ecs/flying-sword";
import {
    defSystem,
} from "@zero-ecs/game";
import { DamageDisplayQuery } from "../damage-display/queries";
import { DemoSceneState } from "../simulation/state";
import {
    RogueEnemyRenderQuery,
    RogueAutoFlyingSwordGroupQuery,
    RogueExperiencePickupQuery,
    RogueLightningArcQuery,
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
        RogueLightningArcQuery,
        RogueAutoFlyingSwordGroupQuery,
        FlyingSwordGroupQuery,
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
    lightningArcs: Parameters<DemoRenderService["render"]>[7],
    swordBuilds: Parameters<DemoRenderService["render"]>[8],
    groups: Parameters<DemoRenderService["render"]>[9],
    swords: Parameters<DemoRenderService["render"]>[10],
): void {
    renderer.render(
        frame.interpolation,
        scene,
        runs,
        cultivators,
        enemies,
        pickups,
        damages,
        lightningArcs,
        swordBuilds,
        groups,
        swords,
    );
}
