/** 飞剑示例本地领域实现。 */
import type { Entity } from "@zero-ecs/game";
import type { ReadonlyVector3 } from "./types";

/** 飞剑技能的公开运行阶段。 */
export const FlyingSwordSkillPhase = Object.freeze({
    Idle: 0,
    Gather: 1,
    Launch: 2,
    Strike: 3,
    Return: 4,
    Rejoin: 5,
} as const);

export type FlyingSwordSkillPhase =
    (typeof FlyingSwordSkillPhase)[keyof typeof FlyingSwordSkillPhase];

/** 内置飞剑技能计划标识。 */
export const FlyingSwordSkillPlanId = Object.freeze({
    PiercingCloud: 1,
} as const);

export type FlyingSwordSkillPlanId =
    (typeof FlyingSwordSkillPlanId)[keyof typeof FlyingSwordSkillPlanId];

/**
 * 冷路径编译完成的飞剑技能计划。
 *
 * 运行时只读取数字字段，不遍历剑诀、剑阵或剑意作者对象。
 */
export interface CompiledFlyingSwordSkillPlan {
    readonly id: number;
    readonly minimumSwords: number;
    readonly maximumSwords: number;
    readonly gatherTicks: number;
    readonly gatherArrivalRatio: number;
    readonly gatherDistance: number;
    readonly gatherHeight: number;
    readonly gatherSpacing: number;
    readonly gatherArrivalRadius: number;
    readonly gatherSpeedMultiplier: number;
    readonly launchWaveCount: number;
    readonly launchIntervalTicks: number;
    readonly launchCurveTicks: number;
    readonly launchLookaheadTicks: number;
    readonly launchAscentHeight: number;
    readonly launchTurnDistance: number;
    readonly launchTimeoutTicks: number;
    readonly launchSpeedMultiplier: number;
    readonly strikeHeight: number;
    readonly strikeSpread: number;
    readonly passDistance: number;
    readonly strikeTicks: number;
    readonly strikeSpeedMultiplier: number;
    readonly returnSpeedMultiplier: number;
    readonly rejoinRadius: number;
    readonly rejoinTicks: number;
    readonly actionTimeoutTicks: number;
}

/** 提交飞剑技能所需的稳定输入。 */
export interface ActivateFlyingSwordSkillOptions {
    readonly group: Entity;
    readonly target: ReadonlyVector3;
    readonly planId?: number;
}
