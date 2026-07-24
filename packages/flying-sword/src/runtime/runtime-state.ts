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
    private readonly groupIds: Entity[] = [];
    private groupCount = 0;

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
            this.groupIds[this.groupCount++] = group;
        }
        return value;
    }

    removeStale(tick: number): void {
        if (tick % 120 !== 0) return;
        const groups = this.groups;
        const groupIds = this.groupIds;
        for (let index = this.groupCount - 1; index >= 0; index--) {
            const group = groupIds[index];
            const snapshot = groups.get(group);
            if (snapshot?.tick === tick) continue;
            groups.delete(group);
            const last = --this.groupCount;
            if (index !== last) groupIds[index] = groupIds[last];
        }
    }

    dispose(): void {
        this.groups.clear();
        this.groupIds.length = 0;
        this.groupCount = 0;
    }
}
