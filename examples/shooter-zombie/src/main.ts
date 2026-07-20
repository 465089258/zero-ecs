import {
<<<<<<< HEAD
    CommandModule, EcsBuilder, ErrorHandlerService, FixedTimeResource,
    RandomModule, RandomService, TimeModule,
} from "zero-ecs-lib";
import { CommonModule } from "./common/index";
import { RendererModule } from "./renderer/index";
import { ShooterModule } from "./shooter/index";
import { BulletModule } from "./bullet/index";
import { DamageTextModule } from "./damage-text/index";
import { ZombieModule } from "./zombie/index";
import { WallModule } from "./wall/index";
import { ExpOrbModule } from "./exp-orb/index";
import { GameModule } from "./game/index";
import { UiModule } from "./ui/index";
import { GameViewResource, type TelemetryElements } from "./common/game-view-resource";
import { MetricsService } from "./common/metrics-service";
import "./styles.css";

const FIXED_STEP = 1 / 120;
const MAX_FRAME_DELTA = 0.1;
const MAX_CATCH_UP_STEPS = 12;

const telemetry: TelemetryElements = {
    fps: document.getElementById("fps")!,
    simMs: document.getElementById("sim-ms")!,
    renderMs: document.getElementById("render-ms")!,
    entities: document.getElementById("entities")!,
    bullets: document.getElementById("bullets")!,
    zombies: document.getElementById("zombies")!,
    score: document.getElementById("score")!,
    wave: document.getElementById("wave")!,
    level: document.getElementById("level")!,
    xp: document.getElementById("xp")!,
    wallHp: document.getElementById("wall-hp")!,
    message: document.getElementById("message")!,
    messageTitle: document.getElementById("message-title")!,
    messageCopy: document.getElementById("message-copy")!,
};

const view = new GameViewResource(
    document.getElementById("game") as HTMLCanvasElement,
    document.getElementById("restart") as HTMLButtonElement,
    document.getElementById("upgrade-panel")!,
    [
        document.getElementById("upgrade-0")!,
        document.getElementById("upgrade-1")!,
        document.getElementById("upgrade-2")!,
    ],
    telemetry,
);
=======
    CommandModule,
    GameBuilder,
    FixedTimeResource,
    RandomModule,
    TimeModule,
} from "@zero-ecs/game";
import { createGameView } from "./app/create-game-view";
import { runGame } from "./app/game-runtime";
import { ShooterZombieModule } from "./modules";
import "./styles.css";

const FIXED_STEP = 1 / 120;
const view = createGameView();
>>>>>>> f2ed160a425365677a1fdc6d6a34dce66590826d

<<<<<<< HEAD
const ecs = new GameBuilder()
=======
const common   = new CommonModule(view);
const renderer = new RendererModule();
const shooter  = new ShooterModule();
const bullet   = new BulletModule();
const dmgText  = new DamageTextModule();
const zombie   = new ZombieModule();
const wall     = new WallModule();
const expOrb   = new ExpOrbModule();
const gameMod  = new GameModule();
const ui       = new UiModule();

const builder = new EcsBuilder()
>>>>>>> eaf72ceda28153b79b4d08389972371de2242457
    .addModule(new CommandModule())
    .addModule(new TimeModule(new FixedTimeResource(FIXED_STEP)))
<<<<<<< HEAD
    .addModule(new RandomModule());

common.build(builder);
renderer.build(builder);
shooter.build(builder);
bullet.build(builder);
dmgText.build(builder);
zombie.build(builder);
wall.build(builder);
expOrb.build(builder);
gameMod.build(builder);
ui.build(builder);

builder.chain(
    gameMod.restartId,
    zombie.spawnId, zombie.moveId,
    wall.collisionId,
    expOrb.collectId,
    shooter.fireId,
    bullet.moveId, bullet.collisionId,
    dmgText.updateId,
    gameMod.levelUpId, gameMod.statsId,
    ui.groundId, ui.waveBarId, ui.telemetryId,
);

const ecs = builder.build();
ecs.init();
ecs.start();
ecs.service(RandomService).seed(0xDEADBEEF);
const metrics = ecs.service(MetricsService)!;

let accumulator = FIXED_STEP;
let previous = performance.now();
let fpsTimer = 0;
let frameCount = 0;

ecs.service(ErrorHandlerService)!.setHandler((error: unknown, source: string) => {
    console.error(`${source} error:`, error);
    document.getElementById("message")!.removeAttribute("hidden");
    document.getElementById("message-title")!.textContent = "Simulation stopped";
    document.getElementById("message-copy")!.textContent = error instanceof Error ? error.message : String(error);
});

function frame(now: number): void {
    const elapsed = Math.min((now - previous) * 0.001, MAX_FRAME_DELTA);
    previous = now;
    accumulator += elapsed;

    let steps = 0;
    const simStart = performance.now();
    while (accumulator >= FIXED_STEP && steps < MAX_CATCH_UP_STEPS) {
        ecs.update();
        accumulator -= FIXED_STEP;
        steps++;
    }
    if (steps === MAX_CATCH_UP_STEPS) accumulator = 0;
    metrics.simulationMs = performance.now() - simStart;
    metrics.renderMs = 0;

    frameCount++;
    fpsTimer += elapsed;
    if (fpsTimer >= 0.5) {
        metrics.fps = Math.round(frameCount / fpsTimer);
        frameCount = 0; fpsTimer = 0;
    }
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
=======
    .addModule(new RandomModule())
    .addModule(new ShooterZombieModule(view))
    .build();

runGame(ecs, view, FIXED_STEP);
>>>>>>> f2ed160a425365677a1fdc6d6a34dce66590826d
