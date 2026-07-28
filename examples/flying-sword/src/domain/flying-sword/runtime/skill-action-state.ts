/** 飞剑示例本地领域运行时。 */
import {
    State,
    type Entity,
} from "@zero-ecs/game";

/**
 * @internal 活跃技能动作实体的固定帧派生索引与工作副本。
 *
 * 权威数据位于技能动作实体组件；该 State 只为飞剑热路径提供稳定的
 * group -> dense index 查询，并在固定帧开始/结束与组件同步。
 */
export class FlyingSwordSkillActionIndexState extends State {
    readonly entities: Entity[] = [];
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
    readonly marks: number[] = [];
    readonly visible: number[] = [];
    readonly indices = new Map<Entity, number>();
    readonly entityIndices = new Map<Entity, number>();
    readonly groupActions = new Map<Entity, Entity>();
    count = 0;

    dispose(): void {
        this.entities.length = 0;
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
        this.marks.length = 0;
        this.visible.length = 0;
        this.indices.clear();
        this.entityIndices.clear();
        this.groupActions.clear();
        this.count = 0;
    }
}

/** @internal 只负责分配非零动作序列号。 */
export class FlyingSwordSkillSequenceState extends State {
    next = 1;

    dispose(): void {
        this.next = 1;
    }
}
