import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderSet } from "../core";
import { FeedbackRenderConfig } from "./config";
import { drawDamageTextsSystem } from "./systems";

export class FeedbackPresentationModule implements Module {
    constructor(readonly config = new FeedbackRenderConfig()) {}

    build(builder: GameBuilder): void {
        builder.addResource(FeedbackRenderConfig, this.config);
        builder.addSystem(drawDamageTextsSystem, {
            inSet: RenderSet.effects,
            after: RenderSet.worldFront,
        });
    }
}
