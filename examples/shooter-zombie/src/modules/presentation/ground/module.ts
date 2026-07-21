import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderSet } from "../core";
import { GroundRenderConfig } from "./config";
import { drawGroundSystem } from "./systems";

export class GroundPresentationModule implements Module {
    constructor(readonly config = new GroundRenderConfig()) {}

    build(builder: GameBuilder): void {
        builder.addResource(GroundRenderConfig, this.config);
        builder.addSystem(drawGroundSystem, {
            inSet: RenderSet.background,
            after: RenderSet.prepare,
        });
    }
}
