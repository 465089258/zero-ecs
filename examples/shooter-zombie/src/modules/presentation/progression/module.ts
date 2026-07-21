import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderSet } from "../core";
import { ProgressionRenderConfig } from "./config";
import { drawExpOrbsSystem } from "./systems";

export class ProgressionPresentationModule implements Module {
    constructor(readonly config = new ProgressionRenderConfig()) {}

    build(builder: GameBuilder): void {
        builder.addResource(ProgressionRenderConfig, this.config);
        builder.addSystem(drawExpOrbsSystem, {
            inSet: RenderSet.worldBack,
            after: RenderSet.background,
        });
    }
}
