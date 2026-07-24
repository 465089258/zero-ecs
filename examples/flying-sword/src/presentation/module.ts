import type {
    GameBuilder,
    Module,
} from "@zero-ecs/game";
import {
    DemoRenderFrameService,
    DemoRenderFrameState,
} from "./render-frame";
import { DemoRenderService } from "./render-service";
import {
    DemoRenderSystemOptions,
    renderFlyingSwordDemoSystem,
} from "./systems";

export class FlyingSwordDemoPresentationModule implements Module {
    build(builder: GameBuilder): void {
        builder
            .addState(DemoRenderFrameState)
            .addService(DemoRenderFrameService)
            .addService(DemoRenderService);
        builder.addSystem(
            renderFlyingSwordDemoSystem,
            DemoRenderSystemOptions,
        );
    }
}
