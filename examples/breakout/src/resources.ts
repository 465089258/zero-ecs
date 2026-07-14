import { Resource } from "zero-ecs-lib";

export class GameConfigResource extends Resource {
    readonly width = 960;
    readonly height = 640;
    readonly wallInset = 20;
    readonly paddleY = 594;
    readonly paddleSpeed = 760;
    readonly ballSpeed = 430;
    readonly brickColumns = 14;
    readonly brickRows = 8;
    readonly brickGap = 6;
    readonly brickTop = 72;
    readonly brickSide = 42;
    readonly brickHeight = 24;
    readonly powerDropChance = 0.18;
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
