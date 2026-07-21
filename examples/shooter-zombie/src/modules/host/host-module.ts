import type { GameBuilder, Module } from "@zero-ecs/game";
import { InputService } from "./input-service";
import { MetricsService } from "./metrics-service";
import { GameViewResource } from "./resources";

/** 安装浏览器宿主适配器；领域模块不允许依赖本模块。 */
export class HostModule implements Module {
    constructor(readonly view: GameViewResource) {}

    build(builder: GameBuilder): void {
        builder
            .addResource(GameViewResource, this.view)
            .addService(InputService)
            .addService(MetricsService);
    }
}

