import type { GameBuilder, Module } from "@zero-ecs/game";
import { RenderFrameService, RenderFrameState } from "./render-frame";
import {
    beginRenderFrameSystem,
    finishRenderFrameSystem,
    RenderCoreSystemOptions,
} from "./systems";

/** 安装与具体图形后端无关的手动渲染阶段和帧状态。 */
export class RenderCoreModule implements Module {
    build(builder: GameBuilder): void {
        builder
            .addState(RenderFrameState)
            .addService(RenderFrameService);
        builder.addSystem(beginRenderFrameSystem, RenderCoreSystemOptions.begin);
        builder.addSystem(finishRenderFrameSystem, RenderCoreSystemOptions.finish);
    }
}
