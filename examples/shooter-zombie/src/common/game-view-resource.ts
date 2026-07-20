import { Resource } from "zero-ecs-lib";

export interface TelemetryElements {
    readonly fps: HTMLElement;
    readonly simMs: HTMLElement;
    readonly renderMs: HTMLElement;
    readonly entities: HTMLElement;
    readonly bullets: HTMLElement;
    readonly zombies: HTMLElement;
    readonly score: HTMLElement;
    readonly wave: HTMLElement;
    readonly level: HTMLElement;
    readonly xp: HTMLElement;
    readonly wallHp: HTMLElement;
    readonly message: HTMLElement;
    readonly messageTitle: HTMLElement;
    readonly messageCopy: HTMLElement;
}

export class GameViewResource extends Resource {
    readonly context: CanvasRenderingContext2D;
    constructor(
        readonly canvas: HTMLCanvasElement,
        readonly restartButton: HTMLButtonElement,
        readonly upgradeContainer: HTMLElement,
        readonly upgradeSlots: readonly [HTMLElement, HTMLElement, HTMLElement],
        readonly telemetry: TelemetryElements,
    ) {
        super();
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas 2D is not available");
        this.context = ctx;
    }
}
