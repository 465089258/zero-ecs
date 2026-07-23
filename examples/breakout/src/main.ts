import {
    CommandModule,
    GameBuilder,
    ErrorHandlerService,
} from "@zero-ecs/game";
import { RandomModule, RandomService } from "@zero-ecs/game/random";
import { FixedTimeResource, TimeModule } from "@zero-ecs/game/time";
import { BreakoutModule } from "./breakout-module";
import { GameViewResource, type TelemetryElements } from "./resources";
import { MetricsService } from "./services/metrics-service";
import { RendererService } from "./services/renderer-service";
import "./styles.css";

const FIXED_STEP = 1 / 120;
const MAX_FRAME_DELTA = 0.1;
const MAX_CATCH_UP_STEPS = 12;

const telemetry: TelemetryElements = {
    fps: element("fps", HTMLElement),
    simMs: element("sim-ms", HTMLElement),
    renderMs: element("render-ms", HTMLElement),
    entities: element("entities", HTMLElement),
    balls: element("balls", HTMLElement),
    bricks: element("bricks", HTMLElement),
    score: element("score", HTMLElement),
    lives: element("lives", HTMLElement),
    message: element("message", HTMLElement),
    messageTitle: element("message-title", HTMLElement),
    messageCopy: element("message-copy", HTMLElement),
};

const view = new GameViewResource(
    element("game", HTMLCanvasElement),
    element("split", HTMLButtonElement),
    element("stress", HTMLButtonElement),
    element("restart", HTMLButtonElement),
    telemetry,
);

const game = new GameBuilder()
    .addModule(new CommandModule())
    .addModule(new TimeModule(new FixedTimeResource(FIXED_STEP)))
    .addModule(new RandomModule())
    .addModule(new BreakoutModule(view))
    .build();

game.init();
game.service(RandomService).seed(0x5EED_BA11);
game.service(ErrorHandlerService).setHandler((error, source) => {
    console.error(`[breakout:${source}]`, error);
});
game.start();

const renderer = game.service(RendererService);
const metrics = game.service(MetricsService);
let previous = performance.now();
let accumulator = FIXED_STEP;
let animationFrame = 0;
let disposed = false;

function frame(now: number): void {
    if (disposed) return;
    const elapsed = Math.min((now - previous) * 0.001, MAX_FRAME_DELTA);
    previous = now;
    accumulator += elapsed;

    const simulationStarted = performance.now();
    let steps = 0;
    try {
        while (accumulator >= FIXED_STEP && steps < MAX_CATCH_UP_STEPS) {
            game.update();
            accumulator -= FIXED_STEP;
            steps++;
        }
        if (steps === MAX_CATCH_UP_STEPS) accumulator = 0;
        metrics.recordSimulation(performance.now() - simulationStarted, steps);
        renderer.render(now);
        animationFrame = requestAnimationFrame(frame);
    } catch (error) {
        console.error("Breakout simulation stopped", error);
        telemetry.message.hidden = false;
        telemetry.messageTitle.textContent = "RUNTIME ERROR";
        telemetry.messageCopy.textContent = error instanceof Error ? error.message : String(error);
    }
}

document.addEventListener("visibilitychange", () => {
    previous = performance.now();
    accumulator = document.hidden ? 0 : FIXED_STEP;
});

window.addEventListener("beforeunload", () => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    game.dispose();
}, { once: true });

animationFrame = requestAnimationFrame(frame);

function element<T extends HTMLElement>(id: string, type: { new(): T }): T {
    const value = document.getElementById(id);
    if (!(value instanceof type)) throw new Error(`Missing ${type.name}#${id}`);
    return value;
}
