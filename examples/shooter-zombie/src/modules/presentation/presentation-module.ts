import type { EcsBuilder, Module } from "zero-ecs-lib";
import { RendererService } from "./renderer-service";

/** 注册 Canvas 渲染与界面同步服务。 */
export class PresentationModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addService(RendererService);
    }
}
