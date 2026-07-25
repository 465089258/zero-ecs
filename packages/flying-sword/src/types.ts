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

/** 创建一个飞剑控制组所需的基础参数。 */
export interface CreateFlyingSwordGroupOptions {
    readonly owner: Entity;
    readonly center?: ReadonlyVector3;
    readonly formationSize?: number;
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

/** 控制组当前的基础控制状态。 */
export enum FlyingSwordControl {
    Mode,
}

export interface FlyingSwordControlViewData {
    readonly [FlyingSwordControl.Mode]: typeof Types.U8;
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
