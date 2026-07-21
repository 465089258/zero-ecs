import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderSet } from "../core";
import { HudRenderConfig } from "./config";
import { DomHudService } from "./dom-hud-service";
import { HudRenderState } from "./state";
import { drawWaveHudSystem, updateDomHudSystem } from "./systems";

export class HudPresentationModule implements Module {
    constructor(readonly config = new HudRenderConfig()) {}

    build(builder: GameBuilder): void {
        builder
            .addResource(HudRenderConfig, this.config)
            .addState(HudRenderState)
            .addService(DomHudService);
        builder.addSystem(drawWaveHudSystem, {
            inSet: RenderSet.hud,
            after: RenderSet.effects,
        });
        builder.addSystem(updateDomHudSystem, {
            inSet: RenderSet.hud,
            after: RenderSet.effects,
        });
    }
}
