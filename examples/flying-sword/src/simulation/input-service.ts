import {
    Inject,
    Service,
} from "@zero-ecs/game";
import { DemoViewResource } from "../app/resources";

export const DemoInputAction = Object.freeze({
    None: 0,
    Focus: 1,
    Orbit: 2,
    Recall: 3,
} as const);

export interface DemoInputOut {
    action: number;
    clientX: number;
    clientY: number;
}

/** 浏览器事件只进入缓存，由固定 Tick Input System 消费。 */
export class DemoInputService extends Service {
    @Inject.resource(DemoViewResource) private readonly view!: DemoViewResource;

    private action: number = DemoInputAction.None;
    private clientX = 0;
    private clientY = 0;

    private readonly onPointerDown = (event: PointerEvent): void => {
        this.action = DemoInputAction.Focus;
        this.clientX = event.clientX;
        this.clientY = event.clientY;
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === "Space") {
            event.preventDefault();
            this.action = DemoInputAction.Orbit;
        } else if (event.code === "KeyR") {
            this.action = DemoInputAction.Recall;
        }
    };

    start(): void {
        this.view.canvas.addEventListener("pointerdown", this.onPointerDown);
        window.addEventListener("keydown", this.onKeyDown);
    }

    stop(): void {
        this.view.canvas.removeEventListener("pointerdown", this.onPointerDown);
        window.removeEventListener("keydown", this.onKeyDown);
        this.action = DemoInputAction.None;
    }

    consume(out: DemoInputOut): boolean {
        if (this.action === DemoInputAction.None) return false;
        out.action = this.action;
        out.clientX = this.clientX;
        out.clientY = this.clientY;
        this.action = DemoInputAction.None;
        return true;
    }
}
