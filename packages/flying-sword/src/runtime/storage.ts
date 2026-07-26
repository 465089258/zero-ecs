import {
    Types,
    type Component,
    type ComponentTag,
} from "@zero-ecs/game";
import { Float3 } from "@zero-ecs/math/3d";
import {
    FlyingSwordAction,
    FlyingSwordBehavior,
    FlyingSwordControl,
    FlyingSwordFlight,
    FlyingSwordFormation,
    FlyingSwordFormationPlan,
    FlyingSwordGroup,
    FlyingSwordMember,
    FlyingSwordSkillAction,
    FlyingSwordSkillProgress,
    FlyingSwordSkillTiming,
    FlyingSwordTask,
    type FlyingSwordActionViewData,
    type FlyingSwordBehaviorViewData,
    type FlyingSwordControlViewData,
    type FlyingSwordFormationViewData,
    type FlyingSwordFormationPlanViewData,
    type FlyingSwordGroupViewData,
    type FlyingSwordMemberViewData,
    type FlyingSwordSkillActionViewData,
    type FlyingSwordSkillProgressViewData,
    type FlyingSwordSkillTimingViewData,
    type FlyingSwordTaskViewData,
} from "../types";

/** @internal 飞剑控制组身份。 */
export class FlyingSwordGroupStorage implements FlyingSwordGroupViewData {
    readonly [FlyingSwordGroup.Owner] = Types.Entity;
}

/** @internal 飞剑控制组中心。 */
export class FlyingSwordGroupCenter3Storage implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

/** @internal 飞剑控制组基础指令目标。 */
export class FlyingSwordGroupTarget3Storage implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

/** @internal 飞剑控制组编队参数。 */
export class FlyingSwordFormationStorage
implements FlyingSwordFormationViewData {
    readonly [FlyingSwordFormation.OrbitRadius] = Types.F32;
    readonly [FlyingSwordFormation.OrbitHeight] = Types.F32;
    readonly [FlyingSwordFormation.AngularSpeed] = Types.F32;
    readonly [FlyingSwordFormation.VerticalAmplitude] = Types.F32;
    readonly [FlyingSwordFormation.VerticalSpeed] = Types.F32;
    readonly [FlyingSwordFormation.Size] = Types.U16;
}

/** @internal 控制组选择的常驻阵图计划。 */
export class FlyingSwordFormationPlanStorage
implements FlyingSwordFormationPlanViewData {
    readonly [FlyingSwordFormationPlan.Plan] = Types.U16;
}

/** @internal 飞剑控制组基础控制状态。 */
export class FlyingSwordControlStorage
implements FlyingSwordControlViewData {
    readonly [FlyingSwordControl.Mode] = Types.U8;
}

/** @internal 控制组常驻姿态与临时动态编队。 */
export class FlyingSwordBehaviorStorage
implements FlyingSwordBehaviorViewData {
    readonly [FlyingSwordBehavior.Stance] = Types.U8;
    readonly [FlyingSwordBehavior.ActiveFormation] = Types.U8;
    readonly [FlyingSwordBehavior.ActiveForwardX] = Types.F32;
    readonly [FlyingSwordBehavior.ActiveForwardZ] = Types.F32;
}

/** @internal 飞剑在控制组中的成员身份。 */
export class FlyingSwordMemberStorage
implements FlyingSwordMemberViewData {
    readonly [FlyingSwordMember.Group] = Types.Entity;
    readonly [FlyingSwordMember.Slot] = Types.U16;
}

/** @internal 飞剑自身的基础飞行属性。 */
export class FlyingSwordFlightStorage
implements Component<FlyingSwordFlight> {
    readonly [FlyingSwordFlight.MaximumSpeed] = Types.F32;
    readonly [FlyingSwordFlight.Acceleration] = Types.F32;
}

/** @internal 编队系统产生的领域目标。 */
export class FlyingSwordFormationGoal3Storage
implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

/** @internal 空闲编队剑尖的跨帧朝向缓存。 */
export class FlyingSwordIdleDirection3Storage
implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

/** @internal 技能预留期间才存在的动作能力。 */
export class FlyingSwordSkillActionStorage
implements FlyingSwordActionViewData {
    readonly [FlyingSwordAction.Action] = Types.Entity;
    readonly [FlyingSwordAction.Phase] = Types.U8;
    readonly [FlyingSwordAction.PhaseStartTick] = Types.U32;
    readonly [FlyingSwordAction.Role] = Types.U16;
    readonly [FlyingSwordAction.TrajectoryStartX] = Types.F32;
    readonly [FlyingSwordAction.TrajectoryStartY] = Types.F32;
    readonly [FlyingSwordAction.TrajectoryStartZ] = Types.F32;
    readonly [FlyingSwordAction.TargetX] = Types.F32;
    readonly [FlyingSwordAction.TargetY] = Types.F32;
    readonly [FlyingSwordAction.TargetZ] = Types.F32;
    readonly [FlyingSwordAction.HasIndividualTarget] = Types.U8;
}

/** @internal 只有能够生成攻击接触事实时才存在。 */
export class FlyingSwordContactWindowStorage implements ComponentTag {}

/** @internal 单把飞剑独立执行的攻击任务。 */
export class FlyingSwordTaskStorage
implements FlyingSwordTaskViewData {
    readonly [FlyingSwordTask.Phase] = Types.U8;
    readonly [FlyingSwordTask.PhaseStartTick] = Types.U32;
    readonly [FlyingSwordTask.StartX] = Types.F32;
    readonly [FlyingSwordTask.StartY] = Types.F32;
    readonly [FlyingSwordTask.StartZ] = Types.F32;
    readonly [FlyingSwordTask.TargetX] = Types.F32;
    readonly [FlyingSwordTask.TargetY] = Types.F32;
    readonly [FlyingSwordTask.TargetZ] = Types.F32;
}

/**
 * @internal 下一次技能获取时消费的每剑目标。
 *
 * 该组件只跨越 Commands 提交边界，不是飞剑的长期业务状态。
 */
export class FlyingSwordPendingSkillTarget3Storage
implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export enum SetFlyingSwordCenterRequest {
    Group,
    X,
    Y,
    Z,
}

/** @internal 修改控制组中心的一次性请求实体。 */
export class SetFlyingSwordCenterRequestStorage
implements Component<SetFlyingSwordCenterRequest> {
    readonly [SetFlyingSwordCenterRequest.Group] = Types.Entity;
    readonly [SetFlyingSwordCenterRequest.X] = Types.F32;
    readonly [SetFlyingSwordCenterRequest.Y] = Types.F32;
    readonly [SetFlyingSwordCenterRequest.Z] = Types.F32;
}

export enum SetFlyingSwordModeRequest {
    Group,
    Mode,
}

/** @internal 修改控制组基础模式的一次性请求实体。 */
export class SetFlyingSwordModeRequestStorage
implements Component<SetFlyingSwordModeRequest> {
    readonly [SetFlyingSwordModeRequest.Group] = Types.Entity;
    readonly [SetFlyingSwordModeRequest.Mode] = Types.U8;
}

export enum SetFlyingSwordFormationSizeRequest {
    Group,
    Size,
}

/** @internal 修改控制组编队容量的一次性请求实体。 */
export class SetFlyingSwordFormationSizeRequestStorage
implements Component<SetFlyingSwordFormationSizeRequest> {
    readonly [SetFlyingSwordFormationSizeRequest.Group] = Types.Entity;
    readonly [SetFlyingSwordFormationSizeRequest.Size] = Types.U16;
}

export enum SetFlyingSwordFormationPlanRequest {
    Group,
    Plan,
}

/** @internal 修改控制组阵图计划的一次性请求实体。 */
export class SetFlyingSwordFormationPlanRequestStorage
implements Component<SetFlyingSwordFormationPlanRequest> {
    readonly [SetFlyingSwordFormationPlanRequest.Group] = Types.Entity;
    readonly [SetFlyingSwordFormationPlanRequest.Plan] = Types.U16;
}

export enum SetFlyingSwordStanceRequest {
    Group,
    Stance,
}

/** @internal 修改控制组常驻姿态的一次性请求实体。 */
export class SetFlyingSwordStanceRequestStorage
implements Component<SetFlyingSwordStanceRequest> {
    readonly [SetFlyingSwordStanceRequest.Group] = Types.Entity;
    readonly [SetFlyingSwordStanceRequest.Stance] = Types.U8;
}

export enum SetFlyingSwordActiveFormationRequest {
    Group,
    Formation,
    ForwardX,
    ForwardZ,
}

/** @internal 修改控制组临时动态编队的一次性请求实体。 */
export class SetFlyingSwordActiveFormationRequestStorage
implements Component<SetFlyingSwordActiveFormationRequest> {
    readonly [SetFlyingSwordActiveFormationRequest.Group] = Types.Entity;
    readonly [SetFlyingSwordActiveFormationRequest.Formation] = Types.U8;
    readonly [SetFlyingSwordActiveFormationRequest.ForwardX] = Types.F32;
    readonly [SetFlyingSwordActiveFormationRequest.ForwardZ] = Types.F32;
}

export enum StartFlyingSwordTaskRequest {
    Sword,
    TargetX,
    TargetY,
    TargetZ,
}

/** @internal 启动单剑异步攻击任务的一次性请求实体。 */
export class StartFlyingSwordTaskRequestStorage
implements Component<StartFlyingSwordTaskRequest> {
    readonly [StartFlyingSwordTaskRequest.Sword] = Types.Entity;
    readonly [StartFlyingSwordTaskRequest.TargetX] = Types.F32;
    readonly [StartFlyingSwordTaskRequest.TargetY] = Types.F32;
    readonly [StartFlyingSwordTaskRequest.TargetZ] = Types.F32;
}

export enum FinishFlyingSwordTaskRequest {
    Sword,
}

/** @internal 让一把攻击中的飞剑立即返航的一次性请求实体。 */
export class FinishFlyingSwordTaskRequestStorage
implements Component<FinishFlyingSwordTaskRequest> {
    readonly [FinishFlyingSwordTaskRequest.Sword] = Types.Entity;
}

export enum CancelFlyingSwordGroupTasksRequest {
    Group,
    Immediate,
}

/** @internal 取消控制组全部单剑任务的一次性请求实体。 */
export class CancelFlyingSwordGroupTasksRequestStorage
implements Component<CancelFlyingSwordGroupTasksRequest> {
    readonly [CancelFlyingSwordGroupTasksRequest.Group] = Types.Entity;
    readonly [CancelFlyingSwordGroupTasksRequest.Immediate] = Types.U8;
}

export enum FocusFlyingSwordRequest {
    Group,
    TargetX,
    TargetY,
    TargetZ,
}

/** @internal 修改目标并进入集火模式的一次性请求实体。 */
export class FocusFlyingSwordRequestStorage
implements Component<FocusFlyingSwordRequest> {
    readonly [FocusFlyingSwordRequest.Group] = Types.Entity;
    readonly [FocusFlyingSwordRequest.TargetX] = Types.F32;
    readonly [FocusFlyingSwordRequest.TargetY] = Types.F32;
    readonly [FocusFlyingSwordRequest.TargetZ] = Types.F32;
}

export enum CastFlyingSwordSkillRequest {
    Group,
    Plan,
    TargetX,
    TargetY,
    TargetZ,
}

/** @internal 施放技能的一次性请求实体。 */
export class CastFlyingSwordSkillRequestStorage
implements Component<CastFlyingSwordSkillRequest> {
    readonly [CastFlyingSwordSkillRequest.Group] = Types.Entity;
    readonly [CastFlyingSwordSkillRequest.Plan] = Types.U16;
    readonly [CastFlyingSwordSkillRequest.TargetX] = Types.F32;
    readonly [CastFlyingSwordSkillRequest.TargetY] = Types.F32;
    readonly [CastFlyingSwordSkillRequest.TargetZ] = Types.F32;
}

export enum SetFlyingSwordSkillTargetRequest {
    Sword,
    TargetX,
    TargetY,
    TargetZ,
}

/** @internal 为下一次技能获取指定单把飞剑目标的一次性请求实体。 */
export class SetFlyingSwordSkillTargetRequestStorage
implements Component<SetFlyingSwordSkillTargetRequest> {
    readonly [SetFlyingSwordSkillTargetRequest.Sword] = Types.Entity;
    readonly [SetFlyingSwordSkillTargetRequest.TargetX] = Types.F32;
    readonly [SetFlyingSwordSkillTargetRequest.TargetY] = Types.F32;
    readonly [SetFlyingSwordSkillTargetRequest.TargetZ] = Types.F32;
}

export enum CancelFlyingSwordSkillRequest {
    Group,
}

/** @internal 取消技能的一次性请求实体。 */
export class CancelFlyingSwordSkillRequestStorage
implements Component<CancelFlyingSwordSkillRequest> {
    readonly [CancelFlyingSwordSkillRequest.Group] = Types.Entity;
}

/** @internal 控制组级技能动作实体身份。 */
export class FlyingSwordSkillActionEntityStorage
implements FlyingSwordSkillActionViewData {
    readonly [FlyingSwordSkillAction.Group] = Types.Entity;
    readonly [FlyingSwordSkillAction.Plan] = Types.U16;
    readonly [FlyingSwordSkillAction.Sequence] = Types.U32;
}

/** @internal 控制组级技能动作目标。 */
export class FlyingSwordSkillTarget3Storage implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

/** @internal 控制组级技能动作时序。 */
export class FlyingSwordSkillTimingStorage
implements FlyingSwordSkillTimingViewData {
    readonly [FlyingSwordSkillTiming.StartTick] = Types.U32;
    readonly [FlyingSwordSkillTiming.PhaseStartTick] = Types.U32;
    readonly [FlyingSwordSkillTiming.Stage] = Types.U8;
    readonly [FlyingSwordSkillTiming.DisplayPhase] = Types.U8;
}

export enum FlyingSwordSkillAcquisition {
    State,
}

/** @internal 动作预留跨 Commands 提交边界的握手状态。 */
export class FlyingSwordSkillAcquisitionStorage
implements Component<FlyingSwordSkillAcquisition> {
    readonly [FlyingSwordSkillAcquisition.State] = Types.U8;
}

/** @internal 控制组级技能动作进度。 */
export class FlyingSwordSkillProgressStorage
implements FlyingSwordSkillProgressViewData {
    readonly [FlyingSwordSkillProgress.ReservedCount] = Types.U16;
    readonly [FlyingSwordSkillProgress.RemainingCount] = Types.U16;
    readonly [FlyingSwordSkillProgress.GatherArrivedCount] = Types.U16;
    readonly [FlyingSwordSkillProgress.ObservedMaximumPhase] = Types.U8;
}
