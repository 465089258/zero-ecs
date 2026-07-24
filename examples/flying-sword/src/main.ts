import {
    CommandModule,
    ErrorHandlerService,
    GameBuilder,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    FlyingSwordModule,
} from "@zero-ecs/flying-sword";
import { DemoViewResource } from "./app/resources";
import {
    FlyingSwordDemoPresentationModule,
} from "./presentation/module";
import {
    DemoRenderFrameService,
} from "./presentation/render-frame";
import { FlyingSwordRender } from "./presentation/render-stage";
import {
    FlyingSwordDemoSimulationModule,
} from "./simulation/module";
import "./styles.css";

const FIXED_STEP = 1 / 60;
const MAX_FRAME_DELTA = 0.1;
const MAX_CATCH_UP_STEPS = 8;

const view = new DemoViewResource(
    element("scene", HTMLCanvasElement),
    element("status", HTMLElement),
);

const game = new GameBuilder()
    .addResource(DemoViewResource, view)
    .addModule(new CommandModule())
    .addModule(new TimeModule(new FixedTimeResource(FIXED_STEP)))
    .addModule(new FlyingSwordModule())
    .addModule(new FlyingSwordDemoSimulationModule())
    .addModule(new FlyingSwordDemoPresentationModule())
    .build();

game.init();
game.service(ErrorHandlerService).setHandler((error, source) => {
    console.error(`[flying-sword:${source}]`, error);
});
game.start();

const renderFrame = game.service(DemoRenderFrameService);
let previous = performance.now();
let accumulator = FIXED_STEP;
let animationFrame = 0;
let disposed = false;

function frame(now: number): void {
    if (disposed) return;
    const elapsed = Math.min((now - previous) * 0.001, MAX_FRAME_DELTA);
    previous = now;
    accumulator += elapsed;

    let steps = 0;
    try {
        while (accumulator >= FIXED_STEP && steps < MAX_CATCH_UP_STEPS) {
            game.update();
            accumulator -= FIXED_STEP;
            steps++;
        }
        if (steps === MAX_CATCH_UP_STEPS) accumulator = 0;
        renderFrame.begin(accumulator / FIXED_STEP);
        game.runStage(FlyingSwordRender);
        animationFrame = requestAnimationFrame(frame);
    } catch (error) {
        disposed = true;
        cancelAnimationFrame(animationFrame);
        view.status.textContent = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error("Flying sword demo stopped", error);
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
