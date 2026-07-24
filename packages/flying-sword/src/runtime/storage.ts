import {
    Types,
    type Component,
    type ComponentTag,
} from "@zero-ecs/game";
import { Float3 } from "@zero-ecs/math/3d";
import {
    FlyingSwordAction,
    FlyingSwordFlight,
    FlyingSwordGroupField,
    FlyingSwordMember,
    type FlyingSwordActionViewData,
    type FlyingSwordGroupViewData,
    type FlyingSwordMemberViewData,
} from "../types";

/** @internal 飞剑控制组的可写物理存储。 */
export class FlyingSwordGroupStorage implements FlyingSwordGroupViewData {
    readonly [FlyingSwordGroupField.Owner] = Types.Entity;
    readonly [FlyingSwordGroupField.CenterX] = Types.F32;
    readonly [FlyingSwordGroupField.CenterY] = Types.F32;
    readonly [FlyingSwordGroupField.CenterZ] = Types.F32;
    readonly [FlyingSwordGroupField.TargetX] = Types.F32;
    readonly [FlyingSwordGroupField.TargetY] = Types.F32;
    readonly [FlyingSwordGroupField.TargetZ] = Types.F32;
    readonly [FlyingSwordGroupField.OrbitRadius] = Types.F32;
    readonly [FlyingSwordGroupField.OrbitHeight] = Types.F32;
    readonly [FlyingSwordGroupField.AngularSpeed] = Types.F32;
    readonly [FlyingSwordGroupField.VerticalAmplitude] = Types.F32;
    readonly [FlyingSwordGroupField.VerticalSpeed] = Types.F32;
    readonly [FlyingSwordGroupField.FormationSize] = Types.U16;
    readonly [FlyingSwordGroupField.Mode] = Types.U8;
    readonly [FlyingSwordGroupField.Revision] = Types.U32;
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
    readonly [FlyingSwordAction.Sequence] = Types.U32;
    readonly [FlyingSwordAction.Phase] = Types.U8;
    readonly [FlyingSwordAction.PhaseStartTick] = Types.U32;
    readonly [FlyingSwordAction.Role] = Types.U16;
    readonly [FlyingSwordAction.TrajectoryStartX] = Types.F32;
    readonly [FlyingSwordAction.TrajectoryStartY] = Types.F32;
    readonly [FlyingSwordAction.TrajectoryStartZ] = Types.F32;
}

/** @internal 只有能够生成攻击接触事实时才存在。 */
export class FlyingSwordContactWindowStorage implements ComponentTag {}
