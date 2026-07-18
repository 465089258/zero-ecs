import type { Module, EcsBuilder } from "zero-ecs-lib";
import { RendererService } from "./renderer-service";
import { RenderState } from "./render-state";

export class RendererModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addService(RendererService);
        builder.addState(RenderState);
    }
}

export { RendererService } from "./renderer-service";
export { RenderState } from "./render-state";
