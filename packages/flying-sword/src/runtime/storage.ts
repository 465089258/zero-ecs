import {
    Types,
    type Component,
    type ComponentTag,
} from "@zero-ecs/game";
import { Float3 } from "@zero-ecs/math/3d";
import {
    FlyingSwordAction,
    FlyingSwordControl,
    FlyingSwordFlight,
    FlyingSwordFormation,
    FlyingSwordGroup,
    FlyingSwordMember,
    FlyingSwordSkillAction,
    FlyingSwordSkillProgress,
    FlyingSwordSkillTiming,
    type FlyingSwordActionViewData,
    type FlyingSwordControlViewData,
    type FlyingSwordFormationViewData,
    type FlyingSwordGroupViewData,
    type FlyingSwordMemberViewData,
    type FlyingSwordSkillActionViewData,
    type FlyingSwordSkillProgressViewData,
    type FlyingSwordSkillTimingViewData,
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

/** @internal 飞剑控制组基础控制状态。 */
export class FlyingSwordControlStorage
implements FlyingSwordControlViewData {
    readonly [FlyingSwordControl.Mode] = Types.U8;
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
}

/** @internal 只有能够生成攻击接触事实时才存在。 */
export class FlyingSwordContactWindowStorage implements ComponentTag {}

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
