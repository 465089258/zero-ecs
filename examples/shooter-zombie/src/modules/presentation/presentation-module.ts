import type { GameBuilder, Module } from "@zero-ecs/game";
import { RendererService } from "./renderer-service";

/** 注册 Canvas 渲染与界面同步服务。 */
export class PresentationModule implements Module {
    build(builder: GameBuilder): void {
        builder.addService(RendererService);
    }
}
