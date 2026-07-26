import {
    State,
    type Entity,
} from "@zero-ecs/game";

/**
 * @internal 控制组组件在当前固定帧的紧凑派生索引。
 *
 * 组件是权威数据；该 State 只把跨 Archetype 的组数据整理成热路径 SoA，
 * 使逐剑系统通过 group -> dense index 读取且不创建临时对象。
 */
export class FlyingSwordGroupIndexState extends State {
    readonly groups: Entity[] = [];
    readonly centerXs: number[] = [];
    readonly centerYs: number[] = [];
    readonly centerZs: number[] = [];
    readonly forwardXs: number[] = [];
    readonly forwardZs: number[] = [];
    readonly targetXs: number[] = [];
    readonly targetYs: number[] = [];
    readonly targetZs: number[] = [];
    readonly orbitRadii: number[] = [];
    readonly orbitHeights: number[] = [];
    readonly angularSpeeds: number[] = [];
    readonly verticalAmplitudes: number[] = [];
    readonly verticalSpeeds: number[] = [];
    readonly formationSizes: number[] = [];
    readonly formationPlans: number[] = [];
    readonly modes: number[] = [];
    readonly stances: number[] = [];
    readonly activeFormations: number[] = [];
    readonly activeForwardXs: number[] = [];
    readonly activeForwardZs: number[] = [];
    readonly transitionStartTicks: number[] = [];
    readonly marks: number[] = [];
    readonly indices = new Map<Entity, number>();
    count = 0;

    dispose(): void {
        this.groups.length = 0;
        this.centerXs.length = 0;
        this.centerYs.length = 0;
        this.centerZs.length = 0;
        this.forwardXs.length = 0;
        this.forwardZs.length = 0;
        this.targetXs.length = 0;
        this.targetYs.length = 0;
        this.targetZs.length = 0;
        this.orbitRadii.length = 0;
        this.orbitHeights.length = 0;
        this.angularSpeeds.length = 0;
        this.verticalAmplitudes.length = 0;
        this.verticalSpeeds.length = 0;
        this.formationSizes.length = 0;
        this.formationPlans.length = 0;
        this.modes.length = 0;
        this.stances.length = 0;
        this.activeFormations.length = 0;
        this.activeForwardXs.length = 0;
        this.activeForwardZs.length = 0;
        this.transitionStartTicks.length = 0;
        this.marks.length = 0;
        this.indices.clear();
        this.count = 0;
    }
}
