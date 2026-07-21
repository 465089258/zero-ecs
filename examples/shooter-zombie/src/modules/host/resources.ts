import { Resource } from "@zero-ecs/game";

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

/** 浏览器宿主提供的视图句柄，只由 Host/Presentation 适配层依赖。 */
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
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Canvas 2D is not available");
        this.context = context;
    }
}

