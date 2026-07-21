import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderSet } from "../core";
import { ProjectileRenderConfig } from "./config";
import { drawProjectilesSystem } from "./systems";

export class ProjectilePresentationModule implements Module {
    constructor(readonly config = new ProjectileRenderConfig()) {}

    build(builder: GameBuilder): void {
        builder.addResource(ProjectileRenderConfig, this.config);
        builder.addSystem(drawProjectilesSystem, {
            inSet: RenderSet.world,
            after: RenderSet.worldBack,
        });
    }
}
