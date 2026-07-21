import type { GameBuilder, Module } from "@zero-ecs/game";
import { CanvasRenderBackendModule, RenderCoreModule } from "./core";
import { DefensePresentationModule } from "./defense";
import { FeedbackPresentationModule } from "./feedback";
import { GroundPresentationModule } from "./ground";
import { HudPresentationModule } from "./hud";
import { ProgressionPresentationModule } from "./progression";
import { ProjectilePresentationModule } from "./projectile";
import { ShooterPresentationModule } from "./shooter";
import { ZombiePresentationModule } from "./zombie";

/** 注册 Canvas 渲染与界面同步服务。 */
export class PresentationModule implements Module {
    constructor(readonly backend: Module = new CanvasRenderBackendModule()) {}

    build(builder: GameBuilder): void {
        builder
            .addModule(new RenderCoreModule())
            .addModule(this.backend)
            .addModule(new GroundPresentationModule())
            .addModule(new DefensePresentationModule())
            .addModule(new ProgressionPresentationModule())
            .addModule(new ZombiePresentationModule())
            .addModule(new ProjectilePresentationModule())
            .addModule(new ShooterPresentationModule())
            .addModule(new FeedbackPresentationModule())
            .addModule(new HudPresentationModule());
    }
}
