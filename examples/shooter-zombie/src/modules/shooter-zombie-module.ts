import type { GameBuilder, Module } from "@zero-ecs/game";
import { AttributeModule } from "./attribute";
import { GameConfigResource, SharedKernelModule } from "./common";
import { DamageModule } from "./damage";
import { FeedbackModule } from "./feedback";
import { GameViewResource, HostModule } from "./host";
import { GameplayIntegrationModule } from "./integration";
import { PresentationModule } from "./presentation";
import { ProjectileModule } from "./projectile";
import { ProgressionModule } from "./progression";
import { ShooterModule } from "./shooter";
import { ZombieModule } from "./zombie";

/** 组合完整游戏所需的共享层与各功能模块。 */
export class ShooterZombieModule implements Module {
    constructor(
        readonly view: GameViewResource,
        readonly config = new GameConfigResource(),
    ) {}

    build(builder: GameBuilder): void {
        builder
            .addModule(new SharedKernelModule(this.config))
            .addModule(new HostModule(this.view))
            .addModule(new ZombieModule())
            .addModule(new ShooterModule())
            .addModule(new ProjectileModule())
            .addModule(new DamageModule())
            .addModule(new AttributeModule())
            .addModule(new ProgressionModule())
            .addModule(new FeedbackModule())
            .addModule(new GameplayIntegrationModule())
            .addModule(new PresentationModule());
    }
}
