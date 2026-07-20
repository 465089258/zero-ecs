import type { GameBuilder, Module } from "@zero-ecs/game";
import { CommonModule } from "./common/common-module";
import { AttributeModule } from "./attribute/attribute-module";
import { DamageModule } from "./damage/damage-module";
import { GameplayIntegrationModule } from "./integration/integration-module";
import { GameConfigResource, GameViewResource } from "./common/resources";
import { LifecycleModule } from "./lifecycle/lifecycle-module";
import { PresentationModule } from "./presentation/presentation-module";
import { ProjectileModule } from "./projectile/projectile-module";
import { ProgressionModule } from "./progression/progression-module";
import { ShooterModule } from "./shooter/shooter-module";
import { ZombieModule } from "./zombie/zombie-module";

/** 组合完整游戏所需的共享层与各功能模块。 */
export class ShooterZombieModule implements Module {
    constructor(
        readonly view: GameViewResource,
        readonly config = new GameConfigResource(),
    ) {}

    build(builder: GameBuilder): void {
        builder
            .addModule(new CommonModule(this.view, this.config))
            .addModule(new LifecycleModule())
            .addModule(new ZombieModule())
            .addModule(new ShooterModule())
            .addModule(new ProjectileModule())
            .addModule(new DamageModule())
            .addModule(new AttributeModule())
            .addModule(new ProgressionModule())
            .addModule(new GameplayIntegrationModule())
            .addModule(new PresentationModule());
    }
}
