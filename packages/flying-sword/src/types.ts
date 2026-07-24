import { Types, type Entity } from "@zero-ecs/game";

/** 只读三维坐标输入。 */
export interface ReadonlyVector3 {
    readonly x: number;
    readonly y: number;
    readonly z: number;
}

/** 可复用三维坐标输出。 */
export interface Vector3Out {
    x: number;
    y: number;
    z: number;
}

/** 控制组当前执行的基础指令。 */
export const FlyingSwordMode = Object.freeze({
    Orbit: 0,
    Focus: 1,
    Recall: 2,
} as const);

export type FlyingSwordMode =
    (typeof FlyingSwordMode)[keyof typeof FlyingSwordMode];

/** 飞剑运行状态。 */
export const FlyingSwordState = Object.freeze({
    Stored: 0,
    Active: 1,
    Returning: 2,
} as const);

export type FlyingSwordState =
    (typeof FlyingSwordState)[keyof typeof FlyingSwordState];

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
    readonly visualId?: number;
    readonly maximumSpeed?: number;
    readonly acceleration?: number;
}

/** 飞剑控制组只读视图中的列索引。 */
export enum FlyingSwordGroupField {
    Owner,
    CenterX,
    CenterY,
    CenterZ,
    TargetX,
    TargetY,
    TargetZ,
    OrbitRadius,
    OrbitHeight,
    AngularSpeed,
    VerticalAmplitude,
    VerticalSpeed,
    FormationSize,
    Mode,
    Revision,
}

/** 飞剑控制组的公开只读数据形状。 */
export interface FlyingSwordGroupViewData {
    readonly [FlyingSwordGroupField.Owner]: typeof Types.Entity;
    readonly [FlyingSwordGroupField.CenterX]: typeof Types.F32;
    readonly [FlyingSwordGroupField.CenterY]: typeof Types.F32;
    readonly [FlyingSwordGroupField.CenterZ]: typeof Types.F32;
    readonly [FlyingSwordGroupField.TargetX]: typeof Types.F32;
    readonly [FlyingSwordGroupField.TargetY]: typeof Types.F32;
    readonly [FlyingSwordGroupField.TargetZ]: typeof Types.F32;
    readonly [FlyingSwordGroupField.OrbitRadius]: typeof Types.F32;
    readonly [FlyingSwordGroupField.OrbitHeight]: typeof Types.F32;
    readonly [FlyingSwordGroupField.AngularSpeed]: typeof Types.F32;
    readonly [FlyingSwordGroupField.VerticalAmplitude]: typeof Types.F32;
    readonly [FlyingSwordGroupField.VerticalSpeed]: typeof Types.F32;
    readonly [FlyingSwordGroupField.FormationSize]: typeof Types.U16;
    readonly [FlyingSwordGroupField.Mode]: typeof Types.U8;
    readonly [FlyingSwordGroupField.Revision]: typeof Types.U32;
}

/** 飞剑只读视图中的列索引。 */
export enum FlyingSwordField {
    Group,
    PreviousX,
    PreviousY,
    PreviousZ,
    X,
    Y,
    Z,
    VelocityX,
    VelocityY,
    VelocityZ,
    ForwardX,
    ForwardY,
    ForwardZ,
    MaximumSpeed,
    Acceleration,
    Slot,
    VisualId,
    State,
    FormationGoalX,
    FormationGoalY,
    FormationGoalZ,
    GoalX,
    GoalY,
    GoalZ,
    ArrivalRadius,
    SpeedMultiplier,
    AccelerationMultiplier,
    ActionSequence,
    ActionPhase,
    ActionPhaseStartTick,
    ActionRole,
    ContactActive,
    TrajectoryStartX,
    TrajectoryStartY,
    TrajectoryStartZ,
}

/** 飞剑的公开只读数据形状。 */
export interface FlyingSwordViewData {
    readonly [FlyingSwordField.Group]: typeof Types.Entity;
    readonly [FlyingSwordField.PreviousX]: typeof Types.F32;
    readonly [FlyingSwordField.PreviousY]: typeof Types.F32;
    readonly [FlyingSwordField.PreviousZ]: typeof Types.F32;
    readonly [FlyingSwordField.X]: typeof Types.F32;
    readonly [FlyingSwordField.Y]: typeof Types.F32;
    readonly [FlyingSwordField.Z]: typeof Types.F32;
    readonly [FlyingSwordField.VelocityX]: typeof Types.F32;
    readonly [FlyingSwordField.VelocityY]: typeof Types.F32;
    readonly [FlyingSwordField.VelocityZ]: typeof Types.F32;
    readonly [FlyingSwordField.ForwardX]: typeof Types.F32;
    readonly [FlyingSwordField.ForwardY]: typeof Types.F32;
    readonly [FlyingSwordField.ForwardZ]: typeof Types.F32;
    readonly [FlyingSwordField.MaximumSpeed]: typeof Types.F32;
    readonly [FlyingSwordField.Acceleration]: typeof Types.F32;
    readonly [FlyingSwordField.Slot]: typeof Types.U16;
    readonly [FlyingSwordField.VisualId]: typeof Types.U16;
    readonly [FlyingSwordField.State]: typeof Types.U8;
    readonly [FlyingSwordField.FormationGoalX]: typeof Types.F32;
    readonly [FlyingSwordField.FormationGoalY]: typeof Types.F32;
    readonly [FlyingSwordField.FormationGoalZ]: typeof Types.F32;
    readonly [FlyingSwordField.GoalX]: typeof Types.F32;
    readonly [FlyingSwordField.GoalY]: typeof Types.F32;
    readonly [FlyingSwordField.GoalZ]: typeof Types.F32;
    readonly [FlyingSwordField.ArrivalRadius]: typeof Types.F32;
    readonly [FlyingSwordField.SpeedMultiplier]: typeof Types.F32;
    readonly [FlyingSwordField.AccelerationMultiplier]: typeof Types.F32;
    readonly [FlyingSwordField.ActionSequence]: typeof Types.U32;
    readonly [FlyingSwordField.ActionPhase]: typeof Types.U8;
    readonly [FlyingSwordField.ActionPhaseStartTick]: typeof Types.U32;
    readonly [FlyingSwordField.ActionRole]: typeof Types.U16;
    readonly [FlyingSwordField.ContactActive]: typeof Types.U8;
    readonly [FlyingSwordField.TrajectoryStartX]: typeof Types.F32;
    readonly [FlyingSwordField.TrajectoryStartY]: typeof Types.F32;
    readonly [FlyingSwordField.TrajectoryStartZ]: typeof Types.F32;
}
