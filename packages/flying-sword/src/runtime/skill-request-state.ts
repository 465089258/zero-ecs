import { State, type Entity } from "@zero-ecs/game";

export const enum FlyingSwordSkillRequestKind {
    Activate,
    Cancel,
}

/** @internal 飞剑技能意图进入固定 Tick 的高水位复用队列。 */
export class FlyingSwordSkillRequestState extends State {
    readonly kinds: number[] = [];
    readonly groups: Entity[] = [];
    readonly planIds: number[] = [];
    readonly targetXs: number[] = [];
    readonly targetYs: number[] = [];
    readonly targetZs: number[] = [];
    count = 0;

    activate(
        group: Entity,
        planId: number,
        targetX: number,
        targetY: number,
        targetZ: number,
    ): void {
        const index = this.count++;
        this.kinds[index] = FlyingSwordSkillRequestKind.Activate;
        this.groups[index] = group;
        this.planIds[index] = planId;
        this.targetXs[index] = targetX;
        this.targetYs[index] = targetY;
        this.targetZs[index] = targetZ;
    }

    cancel(group: Entity): void {
        const index = this.count++;
        this.kinds[index] = FlyingSwordSkillRequestKind.Cancel;
        this.groups[index] = group;
        this.planIds[index] = 0;
        this.targetXs[index] = 0;
        this.targetYs[index] = 0;
        this.targetZs[index] = 0;
    }

    clear(): void {
        this.count = 0;
    }

    dispose(): void {
        this.kinds.length = 0;
        this.groups.length = 0;
        this.planIds.length = 0;
        this.targetXs.length = 0;
        this.targetYs.length = 0;
        this.targetZs.length = 0;
        this.count = 0;
    }
}

