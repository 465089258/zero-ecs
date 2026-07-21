import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderSet } from "../core";
import { DefenseRenderConfig } from "./config";
import { drawDefenseSystem } from "./systems";

export class DefensePresentationModule implements Module {
    constructor(readonly config = new DefenseRenderConfig()) {}

    build(builder: GameBuilder): void {
        builder.addResource(DefenseRenderConfig, this.config);
        builder.addSystem(drawDefenseSystem, {
            inSet: RenderSet.worldBack,
            after: RenderSet.background,
        });
    }
}
