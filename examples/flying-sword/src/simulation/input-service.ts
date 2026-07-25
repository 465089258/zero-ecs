import {
    Inject,
    Service,
} from "@zero-ecs/game";
import { DemoViewResource } from "../app/resources";

export const DemoInputAction = Object.freeze({
    None: 0,
    Move: 1,
    Focus: 2,
    ToggleFormation: 3,
    Recall: 4,
    Fusion: 5,
} as const);

export interface DemoInputOut {
    action: number;
    clientX: number;
    clientY: number;
}

export interface DemoMovementOut {
    right: number;
    forward: number;
}

/** 浏览器事件只进入缓存，由固定 Tick Input System 消费。 */
export class DemoInputService extends Service {
    @Inject.resource(DemoViewResource) private readonly view!: DemoViewResource;

    private action: number = DemoInputAction.None;
    private clientX = 0;
    private clientY = 0;
    private moveLeft = false;
    private moveRight = false;
    private moveForward = false;
    private moveBackward = false;

    private readonly onPointerDown = (event: PointerEvent): void => {
        if (event.button === 0) {
            this.action = DemoInputAction.Move;
        } else if (event.button === 2) {
            this.action = DemoInputAction.Focus;
        } else {
            return;
        }
        event.preventDefault();
        this.clientX = event.clientX;
        this.clientY = event.clientY;
    };

    private readonly onPointerMove = (event: PointerEvent): void => {
        this.clientX = event.clientX;
        this.clientY = event.clientY;
    };

    private readonly onContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === "KeyA") {
            this.moveLeft = true;
            event.preventDefault();
        } else if (event.code === "KeyD") {
            this.moveRight = true;
            event.preventDefault();
        } else if (event.code === "KeyW") {
            this.moveForward = true;
            event.preventDefault();
        } else if (event.code === "KeyS") {
            this.moveBackward = true;
            event.preventDefault();
        } else if (event.code === "Space") {
            event.preventDefault();
            this.action = DemoInputAction.Fusion;
        } else if (event.code === "KeyQ") {
            event.preventDefault();
            this.action = DemoInputAction.ToggleFormation;
        } else if (event.code === "KeyR") {
            event.preventDefault();
            this.action = DemoInputAction.Recall;
        }
    };

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        if (event.code === "KeyA") {
            this.moveLeft = false;
        } else if (event.code === "KeyD") {
            this.moveRight = false;
        } else if (event.code === "KeyW") {
            this.moveForward = false;
        } else if (event.code === "KeyS") {
            this.moveBackward = false;
        } else {
            return;
        }
        event.preventDefault();
    };

    start(): void {
        this.view.canvas.addEventListener("pointerdown", this.onPointerDown);
        this.view.canvas.addEventListener("pointermove", this.onPointerMove);
        this.view.canvas.addEventListener("contextmenu", this.onContextMenu);
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
    }

    stop(): void {
        this.view.canvas.removeEventListener("pointerdown", this.onPointerDown);
        this.view.canvas.removeEventListener("pointermove", this.onPointerMove);
        this.view.canvas.removeEventListener("contextmenu", this.onContextMenu);
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        this.action = DemoInputAction.None;
        this.moveLeft = false;
        this.moveRight = false;
        this.moveForward = false;
        this.moveBackward = false;
    }

    consume(out: DemoInputOut): boolean {
        if (this.action === DemoInputAction.None) return false;
        out.action = this.action;
        out.clientX = this.clientX;
        out.clientY = this.clientY;
        this.action = DemoInputAction.None;
        return true;
    }

    readMovement(out: DemoMovementOut): boolean {
        out.right = Number(this.moveRight) - Number(this.moveLeft);
        out.forward =
            Number(this.moveForward) - Number(this.moveBackward);
        return out.right !== 0 || out.forward !== 0;
    }
}
