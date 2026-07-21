import { defSystem } from "@zero-ecs/game";
import { MetricsService } from "../../host";
import { RenderFrameState } from "./render-frame";
import { RenderService } from "./render-service";
import { Render, RenderSet } from "./render-stage";

export const beginRenderFrameSystem = defSystem(Render, beginRenderFrame, [RenderService]);
export const finishRenderFrameSystem = defSystem(Render, finishRenderFrame, [
    RenderService, RenderFrameState, MetricsService,
]);

function beginRenderFrame(renderer: RenderService): void {
    renderer.beginFrame();
}

function finishRenderFrame(
    renderer: RenderService,
    frame: Readonly<RenderFrameState>,
    metrics: MetricsService,
): void {
    renderer.finishFrame();
    metrics.recordRender(performance.now() - frame.startedAt, frame.now);
}

export const RenderCoreSystemOptions = Object.freeze({
    begin: { inSet: RenderSet.prepare } as const,
    finish: { inSet: RenderSet.finish, after: RenderSet.hud } as const,
});
