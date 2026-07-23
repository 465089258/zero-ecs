import { Inject, Service } from "@zero-ecs/game";
import { GameConfigResource, GameViewResource } from "../resources";

export class InputService extends Service {
    @Inject.resource(GameViewResource) private readonly view!: GameViewResource;
    @Inject.resource(GameConfigResource) private readonly config!: GameConfigResource;

    private left = false;
    private right = false;
    private pointerX = -1;
    private restartRequests = 0;
    private splitRequests = 0;
    private stressRequests = 0;

    private readonly keyDown = (event: KeyboardEvent): void => {
        if (event.code === "ArrowLeft" || event.code === "KeyA") this.left = true;
        if (event.code === "ArrowRight" || event.code === "KeyD") this.right = true;
        if (event.code === "KeyR") this.restartRequests++;
        if (event.code === "Space") this.splitRequests++;
        if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
    };
    private readonly keyUp = (event: KeyboardEvent): void => {
        if (event.code === "ArrowLeft" || event.code === "KeyA") this.left = false;
        if (event.code === "ArrowRight" || event.code === "KeyD") this.right = false;
    };
    private readonly pointerMove = (event: PointerEvent): void => {
        const rect = this.view.canvas.getBoundingClientRect();
        this.pointerX = (event.clientX - rect.left) * this.config.width / rect.width;
    };
    private readonly pointerLeave = (): void => { this.pointerX = -1; };
    private readonly requestRestart = (): void => { this.restartRequests++; };
    private readonly requestSplit = (): void => { this.splitRequests++; };
    private readonly requestStress = (): void => { this.stressRequests++; };

    start(): void {
        window.addEventListener("keydown", this.keyDown, { passive: false });
        window.addEventListener("keyup", this.keyUp);
        this.view.canvas.addEventListener("pointermove", this.pointerMove);
        this.view.canvas.addEventListener("pointerleave", this.pointerLeave);
        this.view.restartButton.addEventListener("click", this.requestRestart);
        this.view.splitButton.addEventListener("click", this.requestSplit);
        this.view.stressButton.addEventListener("click", this.requestStress);
    }

    axis(): number { return Number(this.right) - Number(this.left); }
    targetX(): number { return this.pointerX; }
    consumeRestart(): boolean { return this.consume("restartRequests"); }
    consumeSplit(): boolean { return this.consume("splitRequests"); }
    consumeStress(): boolean { return this.consume("stressRequests"); }
    clearTransient(): void {
        this.splitRequests = 0;
        this.stressRequests = 0;
    }

    stop(): void {
        window.removeEventListener("keydown", this.keyDown);
        window.removeEventListener("keyup", this.keyUp);
        this.view.canvas.removeEventListener("pointermove", this.pointerMove);
        this.view.canvas.removeEventListener("pointerleave", this.pointerLeave);
        this.view.restartButton.removeEventListener("click", this.requestRestart);
        this.view.splitButton.removeEventListener("click", this.requestSplit);
        this.view.stressButton.removeEventListener("click", this.requestStress);
    }

    private consume(field: "restartRequests" | "splitRequests" | "stressRequests"): boolean {
        if (this[field] === 0) return false;
        this[field]--;
        return true;
    }
}
