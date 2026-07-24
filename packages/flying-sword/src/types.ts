import {
    Types,
    type Entity,
} from "@zero-ecs/game";

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
    Sequence,
    Phase,
    PhaseStartTick,
    Role,
    TrajectoryStartX,
    TrajectoryStartY,
    TrajectoryStartZ,
}

export interface FlyingSwordActionViewData {
    readonly [FlyingSwordAction.Sequence]: typeof Types.U32;
    readonly [FlyingSwordAction.Phase]: typeof Types.U8;
    readonly [FlyingSwordAction.PhaseStartTick]: typeof Types.U32;
    readonly [FlyingSwordAction.Role]: typeof Types.U16;
    readonly [FlyingSwordAction.TrajectoryStartX]: typeof Types.F32;
    readonly [FlyingSwordAction.TrajectoryStartY]: typeof Types.F32;
    readonly [FlyingSwordAction.TrajectoryStartZ]: typeof Types.F32;
}
