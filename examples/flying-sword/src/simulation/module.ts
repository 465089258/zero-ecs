import type {
    GameBuilder,
    Module,
} from "@zero-ecs/game";
import { DemoInputService } from "./input-service";
import { DemoSceneState } from "./state";
import {
    DemoGroupCenterSystemOptions,
    DemoInputSystemOptions,
    DemoMovementResultSystemOptions,
    consumeFlyingSwordInputSystem,
    resolveCultivatorMovementSystem,
    setupFlyingSwordDemoSystem,
    synchronizeFlyingSwordGroupCenterSystem,
} from "./systems";

export class FlyingSwordDemoSimulationModule implements Module {
    build(builder: GameBuilder): void {
        builder
            .addState(DemoSceneState)
            .addService(DemoInputService);
        builder.addSystem(setupFlyingSwordDemoSystem);
        builder.addSystem(
            consumeFlyingSwordInputSystem,
            DemoInputSystemOptions,
        );
        builder.addSystem(
            synchronizeFlyingSwordGroupCenterSystem,
            DemoGroupCenterSystemOptions,
        );
        builder.addSystem(
            resolveCultivatorMovementSystem,
            DemoMovementResultSystemOptions,
        );
    }
}
