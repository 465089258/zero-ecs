import { State, type Entity } from "@zero-ecs/game";
import { FlyingSwordSkillPhase } from "../skill-types";

/** @internal 活跃飞剑技能动作的紧凑 SoA 状态。 */
export class FlyingSwordSkillActionState extends State {
    readonly groups: Entity[] = [];
    readonly planIds: number[] = [];
    readonly sequences: number[] = [];
    readonly targetXs: number[] = [];
    readonly targetYs: number[] = [];
    readonly targetZs: number[] = [];
    readonly startTicks: number[] = [];
    readonly phaseStartTicks: number[] = [];
    readonly stages: number[] = [];
    readonly displayPhases: number[] = [];
    readonly acquired: number[] = [];
    readonly reservedCounts: number[] = [];
    readonly remainingCounts: number[] = [];
    readonly gatherArrivedCounts: number[] = [];
    readonly observedMaximumPhases: number[] = [];
    readonly indices = new Map<Entity, number>();
    count = 0;
    private nextSequence = 1;

    activate(
        group: Entity,
        planId: number,
        targetX: number,
        targetY: number,
        targetZ: number,
        tick: number,
    ): number {
        let index = this.indices.get(group);
        if (index === undefined) {
            index = this.count++;
            this.indices.set(group, index);
            this.groups[index] = group;
            this.sequences[index] = this.takeSequence();
        }
        this.planIds[index] = planId;
        this.targetXs[index] = targetX;
        this.targetYs[index] = targetY;
        this.targetZs[index] = targetZ;
        this.startTicks[index] = tick;
        this.phaseStartTicks[index] = tick;
        this.stages[index] = FlyingSwordSkillPhase.Gather;
        this.displayPhases[index] = FlyingSwordSkillPhase.Gather;
        this.acquired[index] = 0;
        this.reservedCounts[index] = 0;
        this.remainingCounts[index] = 0;
        this.gatherArrivedCounts[index] = 0;
        this.observedMaximumPhases[index] = FlyingSwordSkillPhase.Gather;
        return index;
    }

    requestReturn(group: Entity, tick: number): boolean {
        const index = this.indices.get(group);
        if (index === undefined) return false;
        this.stages[index] = FlyingSwordSkillPhase.Return;
        this.displayPhases[index] = FlyingSwordSkillPhase.Return;
        this.phaseStartTicks[index] = tick;
        return true;
    }

    remove(index: number): void {
        const last = this.count - 1;
        if (index < 0 || index > last) return;
        this.indices.delete(this.groups[index]);
        if (index !== last) {
            this.groups[index] = this.groups[last];
            this.planIds[index] = this.planIds[last];
            this.sequences[index] = this.sequences[last];
            this.targetXs[index] = this.targetXs[last];
            this.targetYs[index] = this.targetYs[last];
            this.targetZs[index] = this.targetZs[last];
            this.startTicks[index] = this.startTicks[last];
            this.phaseStartTicks[index] = this.phaseStartTicks[last];
            this.stages[index] = this.stages[last];
            this.displayPhases[index] = this.displayPhases[last];
            this.acquired[index] = this.acquired[last];
            this.reservedCounts[index] = this.reservedCounts[last];
            this.remainingCounts[index] = this.remainingCounts[last];
            this.gatherArrivedCounts[index] = this.gatherArrivedCounts[last];
            this.observedMaximumPhases[index] =
                this.observedMaximumPhases[last];
            this.indices.set(this.groups[index], index);
        }
        this.count = last;
    }

    dispose(): void {
        this.groups.length = 0;
        this.planIds.length = 0;
        this.sequences.length = 0;
        this.targetXs.length = 0;
        this.targetYs.length = 0;
        this.targetZs.length = 0;
        this.startTicks.length = 0;
        this.phaseStartTicks.length = 0;
        this.stages.length = 0;
        this.displayPhases.length = 0;
        this.acquired.length = 0;
        this.reservedCounts.length = 0;
        this.remainingCounts.length = 0;
        this.gatherArrivedCounts.length = 0;
        this.observedMaximumPhases.length = 0;
        this.indices.clear();
        this.count = 0;
        this.nextSequence = 1;
    }

    private takeSequence(): number {
        const sequence = this.nextSequence;
        this.nextSequence = (sequence + 1) >>> 0;
        if (this.nextSequence === 0) this.nextSequence = 1;
        return sequence;
    }
}

