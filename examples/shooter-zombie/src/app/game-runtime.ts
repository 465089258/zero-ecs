import {
    Game,
    ErrorHandlerService,
} from "@zero-ecs/game";
import { RandomService } from "@zero-ecs/game/random";
import { GameViewResource, MetricsService } from "../modules/host";
import { Render, RenderFrameService } from "../modules/presentation";

const MAX_FRAME_DELTA = 0.1;
const MAX_CATCH_UP_STEPS = 12;

export function runGame(ecs: Game, view: GameViewResource, fixedStep: number): void {
    ecs.init();
    ecs.service(RandomService).seed(0xDEAD_BEEF);
    ecs.service(ErrorHandlerService).setHandler((error, source) => {
        console.error(`[shooter:${source}]`, error);
    });
    ecs.start();

    const renderFrame = ecs.service(RenderFrameService);
    const metrics = ecs.service(MetricsService);
    let previous = performance.now();
    let accumulator = fixedStep;
    let animationFrame = 0;
    let disposed = false;

    const frame = (now: number): void => {
        if (disposed) return;
        const elapsed = Math.min((now - previous) * 0.001, MAX_FRAME_DELTA);
        previous = now;
        accumulator += elapsed;

        const simulationStarted = performance.now();
        let steps = 0;
        try {
            while (accumulator >= fixedStep && steps < MAX_CATCH_UP_STEPS) {
                ecs.update();
                accumulator -= fixedStep;
                steps++;
            }
            if (steps === MAX_CATCH_UP_STEPS) accumulator = 0;
            metrics.recordSimulation(performance.now() - simulationStarted, steps);
            renderFrame.begin(now, elapsed, accumulator / fixedStep);
            ecs.runStage(Render);
            animationFrame = requestAnimationFrame(frame);
        } catch (error) {
            disposed = true;
            cancelAnimationFrame(animationFrame);
            try { ecs.dispose(); }
            catch (disposeError) { console.error("Failed to dispose shooter simulation", disposeError); }
            console.error("Shooter simulation stopped", error);
            view.telemetry.message.hidden = false;
            view.telemetry.messageTitle.textContent = "RUNTIME ERROR";
            view.telemetry.messageCopy.textContent = error instanceof Error ? error.message : String(error);
        }
    };

    document.addEventListener("visibilitychange", () => {
        previous = performance.now();
        accumulator = document.hidden ? 0 : fixedStep;
    });

    window.addEventListener("beforeunload", () => {
        disposed = true;
        cancelAnimationFrame(animationFrame);
        ecs.dispose();
    }, { once: true });

    animationFrame = requestAnimationFrame(frame);
}
