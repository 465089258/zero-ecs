import type { GameBuilder, Module } from "@zero-ecs/game";
import { CanvasRenderService } from "./canvas-render-service";

/** 为抽象 RenderService 选择 Canvas 2D 实现。 */
export class CanvasRenderBackendModule implements Module {
    build(builder: GameBuilder): void {
        builder.addService(CanvasRenderService);
    }
}
