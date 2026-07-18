import { Update, type Module, type EcsBuilder, type SystemHandle } from "zero-ecs-lib";
import { RenderState } from "../renderer/render-state";
import { RendererService } from "../renderer/renderer-service";
import { WaveState } from "../zombie/wave-state";
import { drawGroundSystem } from "./draw-ground";
import { drawWaveBarSystem } from "./draw-wave-bar";
import { drawTelemetrySystem } from "./draw-telemetry";

export class UiModule implements Module {
    groundId: SystemHandle = 0 as any;
    waveBarId: SystemHandle = 0 as any;
    telemetryId: SystemHandle = 0 as any;

    build(builder: EcsBuilder): void {
        this.groundId = builder.addSystem(Update.fixed, drawGroundSystem, [
            RenderState, RendererService,
        ]);
        this.waveBarId = builder.addSystem(Update.fixed, drawWaveBarSystem, [
            RenderState, WaveState,
        ]);
        this.telemetryId = builder.addSystem(Update.fixed, drawTelemetrySystem, [
            RenderState,
        ]);
    }
}
