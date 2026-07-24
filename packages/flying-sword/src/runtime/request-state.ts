import { State, type Entity } from "@zero-ecs/game";
import type { FlyingSwordMode } from "../types";

export const enum FlyingSwordRequestKind {
    SetMode,
    SetTargetPoint,
    SetCenter,
}

/** @internal 宿主意图进入固定 Tick 的复用队列。 */
export class FlyingSwordRequestState extends State {
    readonly kinds: number[] = [];
    readonly groups: Entity[] = [];
    readonly xs: number[] = [];
    readonly ys: number[] = [];
    readonly zs: number[] = [];
    readonly modes: number[] = [];
    count = 0;

    setMode(group: Entity, mode: FlyingSwordMode): void {
        const index = this.count++;
        this.kinds[index] = FlyingSwordRequestKind.SetMode;
        this.groups[index] = group;
        this.xs[index] = 0;
        this.ys[index] = 0;
        this.zs[index] = 0;
        this.modes[index] = mode;
    }

    setTargetPoint(group: Entity, x: number, y: number, z: number): void {
        const index = this.count++;
        this.kinds[index] = FlyingSwordRequestKind.SetTargetPoint;
        this.groups[index] = group;
        this.xs[index] = x;
        this.ys[index] = y;
        this.zs[index] = z;
        this.modes[index] = 0;
    }

    setCenter(group: Entity, x: number, y: number, z: number): void {
        const index = this.count++;
        this.kinds[index] = FlyingSwordRequestKind.SetCenter;
        this.groups[index] = group;
        this.xs[index] = x;
        this.ys[index] = y;
        this.zs[index] = z;
        this.modes[index] = 0;
    }

    clear(): void {
        this.count = 0;
    }

    dispose(): void {
        this.kinds.length = 0;
        this.groups.length = 0;
        this.xs.length = 0;
        this.ys.length = 0;
        this.zs.length = 0;
        this.modes.length = 0;
        this.count = 0;
    }
}
