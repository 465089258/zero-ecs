import { State, type Entity } from "@zero-ecs/game";
import type { FlyingSwordMode } from "../types";

export interface FlyingSwordGroupSnapshot {
    tick: number;
    centerX: number;
    centerY: number;
    centerZ: number;
    targetX: number;
    targetY: number;
    targetZ: number;
    orbitRadius: number;
    orbitHeight: number;
    angularSpeed: number;
    verticalAmplitude: number;
    verticalSpeed: number;
    formationSize: number;
    mode: FlyingSwordMode;
}

/** @internal 固定 Tick 内供各批量系统共享的控制组快照。 */
export class FlyingSwordRuntimeState extends State {
    readonly groups = new Map<Entity, FlyingSwordGroupSnapshot>();

    snapshot(group: Entity): FlyingSwordGroupSnapshot {
        let value = this.groups.get(group);
        if (!value) {
            value = {
                tick: 0,
                centerX: 0,
                centerY: 0,
                centerZ: 0,
                targetX: 0,
                targetY: 0,
                targetZ: 0,
                orbitRadius: 0,
                orbitHeight: 0,
                angularSpeed: 0,
                verticalAmplitude: 0,
                verticalSpeed: 0,
                formationSize: 1,
                mode: 0,
            };
            this.groups.set(group, value);
        }
        return value;
    }

    removeStale(tick: number): void {
        if (tick % 120 !== 0) return;
        for (const [group, snapshot] of this.groups) {
            if (snapshot.tick !== tick) this.groups.delete(group);
        }
    }

    dispose(): void {
        this.groups.clear();
    }
}
