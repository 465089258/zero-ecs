import { describe, expect, test } from "@rstest/core";
import {
    CommandModule,
    defSystem,
    FixedTimeResource,
    type Game,
    GameBuilder,
    RandomModule,
    State,
    TimeModule,
    Update,
    Write,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { Float2 } from "../../examples/shooter-zombie/src/modules/common/components";
import { GameMode, GameSessionState } from "../../examples/shooter-zombie/src/modules/common/game-state";
import { GameConfigResource } from "../../examples/shooter-zombie/src/modules/common/resources";
import { DamageRequest } from "../../examples/shooter-zombie/src/modules/damage/components";
import { DamageRequestQuery } from "../../examples/shooter-zombie/src/modules/damage/queries";
import { resolveDamageSystem } from "../../examples/shooter-zombie/src/modules/damage/systems";
import { GameViewResource } from "../../examples/shooter-zombie/src/modules/host/resources";
import { GameContentService } from "../../examples/shooter-zombie/src/modules/integration/game-content-service";
import {
    GameplayStatisticsState,
    WaveState,
} from "../../examples/shooter-zombie/src/modules/integration/state";
import { ExpOrbQuery } from "../../examples/shooter-zombie/src/modules/progression/queries";
import { expCollectSystem } from "../../examples/shooter-zombie/src/modules/progression/systems";
import {
    Render,
    RenderFrameService,
    RenderFrameState,
} from "../../examples/shooter-zombie/src/modules/presentation/core";
import { ShooterZombieModule } from "../../examples/shooter-zombie/src/modules/shooter-zombie-module";

class RuntimeCaptureState extends State {
    orbX = Number.NaN;
    wallDamage = Number.NaN;
}

const captureExpOrbSystem = defSystem(Update.fixed, captureExpOrb, [
    Write(RuntimeCaptureState), ExpOrbQuery,
]);
const captureDamageRequestSystem = defSystem(Update.fixed, captureDamageRequest, [
    Write(RuntimeCaptureState), DamageRequestQuery,
]);

describe("shooter-zombie runtime", () => {
    test("boots the complete module graph and advances gameplay", () => {
        const environment = installBrowserStubs();
        const game = createTestGame(environment.view, 1 / 120);

        try {
            game.init();
            game.start();
            for (let i = 0; i < 8; i++) game.update();
            game.service(RenderFrameService).begin(100, 1 / 60, 0.5);
            game.runStage(Render);

            expect(game.state(GameSessionState).mode).toBe(GameMode.Playing);
            expect(game.state(RenderFrameState).frameIndex).toBe(1);
            expect(game.state(WaveState).wave).toBe(1);
            const statistics = game.state(GameplayStatisticsState);
            expect(statistics.entities).toBeGreaterThanOrEqual(3);
            expect(statistics.wallMaxHp).toBe(2000);
        } finally {
            game.dispose();
            environment.restore();
        }
    });

    test("keeps a newly materialized horde alive until statistics observe it", () => {
        const environment = installBrowserStubs();
        const config = new GameConfigResource();
        Object.assign(config, { waveInterval: 0.25, maxZombies: 10 });
        const game = createTestGame(environment.view, 0.25, config);

        try {
            game.init();
            game.start();
            game.update();
            game.update();
            game.update();

            expect(game.state(GameSessionState).mode).toBe(GameMode.Playing);
            const wave = game.state(WaveState);
            const statistics = game.state(GameplayStatisticsState);
            expect(wave.inHorde).toBe(true);
            expect(statistics.zombies).toBeGreaterThan(0);
            expect(wave.spawnQueue).toBe(0);
            expect(wave.waveZombieTotal).toBe(statistics.zombies);
        } finally {
            game.dispose();
            environment.restore();
        }
    });

    test("includes deferred spawns when enforcing the zombie limit", () => {
        const environment = installBrowserStubs();
        const config = new GameConfigResource();
        Object.assign(config, {
            maxZombies: 1,
            waveInterval: 60,
            spawnDelayMin: 0.15,
            spawnDelayMax: 0.4,
        });
        const game = createTestGame(environment.view, 0.25, config);

        try {
            game.init();
            game.start();
            for (let i = 0; i < 12; i++) game.update();

            expect(game.state(GameplayStatisticsState).zombies).toBe(1);
        } finally {
            game.dispose();
            environment.restore();
        }
    });

    test("uses the configured fixed delta for movement and contact damage", () => {
        const environment = installBrowserStubs();
        const config = new GameConfigResource();
        Object.assign(config, { maxZombies: 0 });
        const fixedStep = 0.25;
        const game = createTestGame(environment.view, fixedStep, config);

        try {
            game.init();
            game.start();
            game.update();

            const content = game.service(GameContentService);
            content.spawnExpOrb(870, config.shooterY, 1);
            content.spawnZombieAt(
                0,
                config.wallX + config.wallHalfWidth + config.zombieRadius,
                config.wallY,
            );
            game.update();
            game.update();
            game.update();

            const capture = game.state(RuntimeCaptureState);
            expect(capture.orbX).toBeCloseTo(705, 4);
            expect(capture.wallDamage).toBeCloseTo(config.zombieDamageBase * fixedStep, 5);
        } finally {
            game.dispose();
            environment.restore();
        }
    });
});

function createTestGame(
    view: GameViewResource,
    fixedStep: number,
    config = new GameConfigResource(),
): Game {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(fixedStep)))
        .addModule(new RandomModule())
        .addState(RuntimeCaptureState)
        .addModule(new ShooterZombieModule(view, config));
    builder.addSystem(captureExpOrbSystem, { after: expCollectSystem });
    builder.addSystem(captureDamageRequestSystem, { before: resolveDamageSystem });
    return builder.build();
}

function captureExpOrb(
    capture: Mut<RuntimeCaptureState>,
    orbs: QueryOf<typeof ExpOrbQuery>,
): void {
    if (!Number.isNaN(capture.orbX)) return;
    const iter = orbs.iter();
    while (iter.next()) {
        if (iter.current[0] === 0) continue;
        const positions = iter.current[2];
        const xs = positions[Float2.x];
        capture.orbX = xs[0];
        return;
    }
}

function captureDamageRequest(
    capture: Mut<RuntimeCaptureState>,
    requests: QueryOf<typeof DamageRequestQuery>,
): void {
    if (!Number.isNaN(capture.wallDamage)) return;
    const iter = requests.iter();
    while (iter.next()) {
        if (iter.current[0] === 0) continue;
        const data = iter.current[2];
        const amounts = data[DamageRequest.amount];
        capture.wallDamage = amounts[0];
        return;
    }
}

function installBrowserStubs(): { readonly view: GameViewResource; restore(): void } {
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const previousRatio = Object.getOwnPropertyDescriptor(globalThis, "devicePixelRatio");
    const windowTarget = new FakeEventTarget();
    Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: windowTarget,
    });
    Object.defineProperty(globalThis, "devicePixelRatio", {
        configurable: true,
        value: 1,
    });

    const restartButton = new FakeEventTarget();
    const context = {
        fillStyle: "",
        strokeStyle: "",
        shadowColor: "",
        shadowBlur: 0,
        lineWidth: 1,
        globalAlpha: 1,
        font: "",
        textAlign: "left" as CanvasTextAlign,
        textBaseline: "alphabetic" as CanvasTextBaseline,
        setTransform(): void {},
        createLinearGradient(): { addColorStop(): void } {
            return { addColorStop(): void {} };
        },
        fillRect(): void {},
        strokeRect(): void {},
        beginPath(): void {},
        arc(): void {},
        fill(): void {},
        stroke(): void {},
        moveTo(): void {},
        lineTo(): void {},
        fillText(): void {},
        strokeText(): void {},
    };
    const canvas = {
        width: 0,
        height: 0,
        getContext(): typeof context { return context; },
    };
    const element = (): HTMLElement => ({
        hidden: false,
        textContent: "",
        innerHTML: "",
    }) as unknown as HTMLElement;
    const view = new GameViewResource(
        canvas as unknown as HTMLCanvasElement,
        restartButton as unknown as HTMLButtonElement,
        element(),
        [element(), element(), element()],
        {
            fps: element(),
            simMs: element(),
            renderMs: element(),
            entities: element(),
            bullets: element(),
            zombies: element(),
            score: element(),
            wave: element(),
            level: element(),
            xp: element(),
            wallHp: element(),
            message: element(),
            messageTitle: element(),
            messageCopy: element(),
        },
    );

    return {
        view,
        restore(): void {
            restoreProperty("window", previousWindow);
            restoreProperty("devicePixelRatio", previousRatio);
        },
    };
}

class FakeEventTarget {
    private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
        let listeners = this.listeners.get(type);
        if (!listeners) this.listeners.set(type, listeners = new Set());
        listeners.add(listener);
    }

    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
        this.listeners.get(type)?.delete(listener);
    }
}

function restoreProperty(name: string, descriptor: PropertyDescriptor | undefined): void {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
}
