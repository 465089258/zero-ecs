import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderSet } from "../core";
import { ShooterRenderConfig } from "./config";
import { drawShootersSystem } from "./systems";

export class ShooterPresentationModule implements Module {
    constructor(readonly config = new ShooterRenderConfig()) {}

    build(builder: GameBuilder): void {
        builder.addResource(ShooterRenderConfig, this.config);
        builder.addSystem(drawShootersSystem, {
            inSet: RenderSet.worldFront,
            after: RenderSet.world,
        });
    }
}
