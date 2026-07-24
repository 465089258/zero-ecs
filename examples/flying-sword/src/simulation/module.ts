import type {
    GameBuilder,
    Module,
} from "@zero-ecs/game";
import { DemoInputService } from "./input-service";
import { DemoFlyingSwordSpatialService } from "./spatial-service";
import { DemoSceneState } from "./state";
import {
    DemoCultivatorMovementSystemOptions,
    DemoInputSystemOptions,
    consumeFlyingSwordInputSystem,
    moveCultivatorsSystem,
    setupFlyingSwordDemoSystem,
} from "./systems";

export class FlyingSwordDemoSimulationModule implements Module {
    build(builder: GameBuilder): void {
        builder
            .addState(DemoSceneState)
            .addService(DemoFlyingSwordSpatialService)
            .addService(DemoInputService);
        builder.addSystem(setupFlyingSwordDemoSystem);
        builder.addSystem(
            consumeFlyingSwordInputSystem,
            DemoInputSystemOptions,
        );
        builder.addSystem(
            moveCultivatorsSystem,
            DemoCultivatorMovementSystemOptions,
        );
    }
}
