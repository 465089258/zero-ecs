import {
    Types,
    type Component,
} from "@zero-ecs/game";

/** 飞剑示例三维 F32 列布局：左右 X、高度 Y、纵深 Z。 */
export enum Float3 {
    X,
    Y,
    Z,
}

export class Position3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class PreviousPosition3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class Velocity3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class Direction3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}
