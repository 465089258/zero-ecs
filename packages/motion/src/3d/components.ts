import {
    Types,
    type Component,
} from "@zero-ecs/game";

/**
 * 已归并完成的三维目标追踪输入。
 *
 * 提供者负责把属性、Buff、技能和领域规则归并为最终数值；Motion 只负责积分。
 */
export enum MoveTowards3 {
    TargetX,
    TargetY,
    TargetZ,
    MaximumSpeed,
    Acceleration,
    ArrivalRadius,
}

export class MoveTowards3Type implements Component<MoveTowards3> {
    readonly [MoveTowards3.TargetX] = Types.F32;
    readonly [MoveTowards3.TargetY] = Types.F32;
    readonly [MoveTowards3.TargetZ] = Types.F32;
    readonly [MoveTowards3.MaximumSpeed] = Types.F32;
    readonly [MoveTowards3.Acceleration] = Types.F32;
    readonly [MoveTowards3.ArrivalRadius] = Types.F32;
}
