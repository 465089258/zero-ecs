import {
    defSystem,
} from "@zero-ecs/game";
import { CultivatorQuery } from "../simulation/components";
import { DemoSceneState } from "../simulation/state";
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
        CultivatorQuery,
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
    cultivators: Parameters<DemoRenderService["render"]>[2],
    swords: Parameters<DemoRenderService["render"]>[3],
): void {
    renderer.render(frame.interpolation, scene, cultivators, swords);
}
