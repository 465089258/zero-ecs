import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderSet } from "../core";
import { ZombieRenderConfig } from "./config";
import { drawZombiesSystem } from "./systems";

export class ZombiePresentationModule implements Module {
    constructor(readonly config = new ZombieRenderConfig()) {}

    build(builder: GameBuilder): void {
        builder.addResource(ZombieRenderConfig, this.config);
        builder.addSystem(drawZombiesSystem, {
            inSet: RenderSet.world,
            after: RenderSet.worldBack,
        });
    }
}
