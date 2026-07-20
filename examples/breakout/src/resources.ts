import { Resource } from "@zero-ecs/game";

export class GameConfigResource extends Resource {
    readonly width = 960;
    readonly height = 640;
    readonly wallInset = 20;
    readonly paddleY = 594;
    readonly paddleSpeed = 760;
    readonly ballSpeed = 430;
    readonly brickColumns = 28;
    readonly brickRows = 18;
    readonly brickSize = 25;
    readonly brickGap = 3;
    readonly brickTop = 40;
    readonly armoredBrickHp = 8;
    readonly innerBrickMinHp = 2;
    readonly innerBrickHpRange = 3;
    readonly powerDropChance = 0.12;
    readonly powerDropSpeed = 190;
    readonly maxBalls = 10_000;
    readonly stressBallCount = 1_000;
}

export interface TelemetryElements {
    readonly fps: HTMLElement;
    readonly simMs: HTMLElement;
    readonly renderMs: HTMLElement;
    readonly entities: HTMLElement;
    readonly balls: HTMLElement;
    readonly bricks: HTMLElement;
    readonly score: HTMLElement;
    readonly lives: HTMLElement;
    readonly message: HTMLElement;
    readonly messageTitle: HTMLElement;
    readonly messageCopy: HTMLElement;
}

export class GameViewResource extends Resource {
    readonly context: CanvasRenderingContext2D;

    constructor(
        readonly canvas: HTMLCanvasElement,
        readonly splitButton: HTMLButtonElement,
        readonly stressButton: HTMLButtonElement,
        readonly restartButton: HTMLButtonElement,
        readonly telemetry: TelemetryElements,
    ) {
        super();
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas 2D is not available");
        this.context = context;
    }
}
