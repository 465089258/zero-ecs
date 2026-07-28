/** 飞剑示例本地领域实现。 */
import {
    Types,
    type Component,
    type Entity,
} from "@zero-ecs/game";
import type { Float3 } from "@zero-ecs/math/3d";

/** 只读三维坐标输入。 */
export interface ReadonlyVector3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** 控制组当前执行的基础指令。 */
export const FlyingSwordMode = Object.freeze({
    Orbit: 0,
    Focus: 1,
    Recall: 2,
} as const);

export type FlyingSwordMode =
    (typeof FlyingSwordMode)[keyof typeof FlyingSwordMode];

/** 控制组的常驻战斗姿态；技能动作可以临时覆盖它。 */
export const FlyingSwordStance = Object.freeze({
    Guard: 0,
    Scatter: 1,
    Formation: 2,
} as const);

export type FlyingSwordStance =
    (typeof FlyingSwordStance)[keyof typeof FlyingSwordStance];

/** 临时覆盖常驻姿态的动态编队。 */
export const FlyingSwordActiveFormation = Object.freeze({
    None: 0,
    FusionSpiral: 1,
} as const);

export type FlyingSwordActiveFormation =
    (typeof FlyingSwordActiveFormation)[keyof typeof FlyingSwordActiveFormation];

/** 单把飞剑异步攻击任务的阶段。 */
export const FlyingSwordTaskPhase = Object.freeze({
    Rise: 0,
    Dive: 1,
    Return: 2,
} as const);

export type FlyingSwordTaskPhase =
    (typeof FlyingSwordTaskPhase)[keyof typeof FlyingSwordTaskPhase];

/** 创建一个飞剑控制组所需的基础参数。 */
export interface CreateFlyingSwordGroupOptions {
    readonly owner: Entity;
    readonly center?: ReadonlyVector3;
    readonly formationSize?: number;
    readonly formationPlan?: number;
    readonly orbitRadius?: number;
    readonly orbitHeight?: number;
    readonly angularSpeed?: number;
    /** 上下浮动幅度，使用世界 Y 轴单位。 */
    readonly verticalAmplitude?: number;
    /** 上下浮动相位速度，单位为弧度/秒。 */
    readonly verticalSpeed?: number;
}

/** 创建一把已出鞘飞剑所需的基础参数。 */
export interface CreateFlyingSwordOptions {
    readonly group: Entity;
    readonly position: ReadonlyVector3;
    readonly slot?: number;
    readonly maximumSpeed?: number;
    readonly acceleration?: number;
}

/** 飞剑控制组的稳定身份。 */
export enum FlyingSwordGroup {
    Owner,
}

export interface FlyingSwordGroupViewData {
    readonly [FlyingSwordGroup.Owner]: typeof Types.Entity;
}

/** 控制组的编队参数。 */
export enum FlyingSwordFormation {
    OrbitRadius,
    OrbitHeight,
    AngularSpeed,
    VerticalAmplitude,
    VerticalSpeed,
    Size,
}

export interface FlyingSwordFormationViewData {
    readonly [FlyingSwordFormation.OrbitRadius]: typeof Types.F32;
    readonly [FlyingSwordFormation.OrbitHeight]: typeof Types.F32;
    readonly [FlyingSwordFormation.AngularSpeed]: typeof Types.F32;
    readonly [FlyingSwordFormation.VerticalAmplitude]: typeof Types.F32;
    readonly [FlyingSwordFormation.VerticalSpeed]: typeof Types.F32;
    readonly [FlyingSwordFormation.Size]: typeof Types.U16;
}

/** 控制组当前选择的常驻阵图计划。 */
export enum FlyingSwordFormationPlan {
    Plan,
}

export interface FlyingSwordFormationPlanViewData {
    readonly [FlyingSwordFormationPlan.Plan]: typeof Types.U16;
}

/** 控制组当前的基础控制状态。 */
export enum FlyingSwordControl {
    Mode,
}

export interface FlyingSwordControlViewData {
    readonly [FlyingSwordControl.Mode]: typeof Types.U8;
}

/** 控制组的常驻姿态与临时动态编队。 */
export enum FlyingSwordBehavior {
    Stance,
    ActiveFormation,
    ActiveForwardX,
    ActiveForwardZ,
}

export interface FlyingSwordBehaviorViewData {
    readonly [FlyingSwordBehavior.Stance]: typeof Types.U8;
    readonly [FlyingSwordBehavior.ActiveFormation]: typeof Types.U8;
    readonly [FlyingSwordBehavior.ActiveForwardX]: typeof Types.F32;
    readonly [FlyingSwordBehavior.ActiveForwardZ]: typeof Types.F32;
}

/** 飞剑在控制组中的稳定成员身份。 */
export enum FlyingSwordMember {
    Group,
    Slot,
}

export interface FlyingSwordMemberViewData {
    readonly [FlyingSwordMember.Group]: typeof Types.Entity;
    readonly [FlyingSwordMember.Slot]: typeof Types.U16;
}

/** 飞剑自身的基础飞行属性。 */
export enum FlyingSwordFlight {
    MaximumSpeed,
    Acceleration,
}

/** 技能期间才存在的飞剑动作数据。 */
export enum FlyingSwordAction {
    Action,
    Phase,
    PhaseStartTick,
    Role,
    TrajectoryStartX,
    TrajectoryStartY,
    TrajectoryStartZ,
    TargetX,
    TargetY,
    TargetZ,
    HasIndividualTarget,
}

export interface FlyingSwordActionViewData {
    readonly [FlyingSwordAction.Action]: typeof Types.Entity;
    readonly [FlyingSwordAction.Phase]: typeof Types.U8;
    readonly [FlyingSwordAction.PhaseStartTick]: typeof Types.U32;
    readonly [FlyingSwordAction.Role]: typeof Types.U16;
    readonly [FlyingSwordAction.TrajectoryStartX]: typeof Types.F32;
    readonly [FlyingSwordAction.TrajectoryStartY]: typeof Types.F32;
    readonly [FlyingSwordAction.TrajectoryStartZ]: typeof Types.F32;
    readonly [FlyingSwordAction.TargetX]: typeof Types.F32;
    readonly [FlyingSwordAction.TargetY]: typeof Types.F32;
    readonly [FlyingSwordAction.TargetZ]: typeof Types.F32;
    readonly [FlyingSwordAction.HasIndividualTarget]: typeof Types.U8;
}

/** 单把飞剑独立执行的短生命周期攻击任务。 */
export enum FlyingSwordTask {
    Phase,
    PhaseStartTick,
    StartX,
    StartY,
    StartZ,
    TargetX,
    TargetY,
    TargetZ,
}

export interface FlyingSwordTaskViewData {
    readonly [FlyingSwordTask.Phase]: typeof Types.U8;
    readonly [FlyingSwordTask.PhaseStartTick]: typeof Types.U32;
    readonly [FlyingSwordTask.StartX]: typeof Types.F32;
    readonly [FlyingSwordTask.StartY]: typeof Types.F32;
    readonly [FlyingSwordTask.StartZ]: typeof Types.F32;
    readonly [FlyingSwordTask.TargetX]: typeof Types.F32;
    readonly [FlyingSwordTask.TargetY]: typeof Types.F32;
    readonly [FlyingSwordTask.TargetZ]: typeof Types.F32;
}

/** 一个控制组级技能动作实体的稳定身份。 */
export enum FlyingSwordSkillAction {
    Group,
    Plan,
    Sequence,
}

export interface FlyingSwordSkillActionViewData {
    readonly [FlyingSwordSkillAction.Group]: typeof Types.Entity;
    readonly [FlyingSwordSkillAction.Plan]: typeof Types.U16;
    readonly [FlyingSwordSkillAction.Sequence]: typeof Types.U32;
}

/** 控制组级技能动作的固定帧时序状态。 */
export enum FlyingSwordSkillTiming {
    StartTick,
    PhaseStartTick,
    Stage,
    DisplayPhase,
}

export interface FlyingSwordSkillTimingViewData {
    readonly [FlyingSwordSkillTiming.StartTick]: typeof Types.U32;
    readonly [FlyingSwordSkillTiming.PhaseStartTick]: typeof Types.U32;
    readonly [FlyingSwordSkillTiming.Stage]: typeof Types.U8;
    readonly [FlyingSwordSkillTiming.DisplayPhase]: typeof Types.U8;
}

/** 控制组级技能动作的批处理计数。 */
export enum FlyingSwordSkillProgress {
    ReservedCount,
    RemainingCount,
    GatherArrivedCount,
    ObservedMaximumPhase,
}

export interface FlyingSwordSkillProgressViewData {
    readonly [FlyingSwordSkillProgress.ReservedCount]: typeof Types.U16;
    readonly [FlyingSwordSkillProgress.RemainingCount]: typeof Types.U16;
    readonly [FlyingSwordSkillProgress.GatherArrivedCount]: typeof Types.U16;
    readonly [FlyingSwordSkillProgress.ObservedMaximumPhase]: typeof Types.U8;
}

/** 公共三维组件数据形状。 */
export type FlyingSwordVector3ViewData = Component<Float3>;
