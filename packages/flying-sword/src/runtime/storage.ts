import { Types } from "@zero-ecs/game";
import {
    FlyingSwordField,
    FlyingSwordGroupField,
    type FlyingSwordGroupViewData,
    type FlyingSwordViewData,
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

/** @internal 飞剑的可写物理存储。 */
export class FlyingSwordStorage implements FlyingSwordViewData {
    readonly [FlyingSwordField.Group] = Types.Entity;
    readonly [FlyingSwordField.PreviousX] = Types.F32;
    readonly [FlyingSwordField.PreviousY] = Types.F32;
    readonly [FlyingSwordField.PreviousZ] = Types.F32;
    readonly [FlyingSwordField.X] = Types.F32;
    readonly [FlyingSwordField.Y] = Types.F32;
    readonly [FlyingSwordField.Z] = Types.F32;
    readonly [FlyingSwordField.VelocityX] = Types.F32;
    readonly [FlyingSwordField.VelocityY] = Types.F32;
    readonly [FlyingSwordField.VelocityZ] = Types.F32;
    readonly [FlyingSwordField.ForwardX] = Types.F32;
    readonly [FlyingSwordField.ForwardY] = Types.F32;
    readonly [FlyingSwordField.ForwardZ] = Types.F32;
    readonly [FlyingSwordField.MaximumSpeed] = Types.F32;
    readonly [FlyingSwordField.Acceleration] = Types.F32;
    readonly [FlyingSwordField.Slot] = Types.U16;
    readonly [FlyingSwordField.VisualId] = Types.U16;
    readonly [FlyingSwordField.State] = Types.U8;
    readonly [FlyingSwordField.FormationGoalX] = Types.F32;
    readonly [FlyingSwordField.FormationGoalY] = Types.F32;
    readonly [FlyingSwordField.FormationGoalZ] = Types.F32;
    readonly [FlyingSwordField.GoalX] = Types.F32;
    readonly [FlyingSwordField.GoalY] = Types.F32;
    readonly [FlyingSwordField.GoalZ] = Types.F32;
    readonly [FlyingSwordField.ArrivalRadius] = Types.F32;
    readonly [FlyingSwordField.SpeedMultiplier] = Types.F32;
    readonly [FlyingSwordField.AccelerationMultiplier] = Types.F32;
    readonly [FlyingSwordField.ActionSequence] = Types.U32;
    readonly [FlyingSwordField.ActionPhase] = Types.U8;
    readonly [FlyingSwordField.ActionPhaseStartTick] = Types.U32;
    readonly [FlyingSwordField.ActionRole] = Types.U16;
    readonly [FlyingSwordField.ContactActive] = Types.U8;
    readonly [FlyingSwordField.TrajectoryStartX] = Types.F32;
    readonly [FlyingSwordField.TrajectoryStartY] = Types.F32;
    readonly [FlyingSwordField.TrajectoryStartZ] = Types.F32;
}
