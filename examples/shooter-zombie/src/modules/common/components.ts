import { Types, type Component, type ComponentTag } from "@zero-ecs/game";

export const enum Float2 { x, y }
export class PositionType implements Component<Float2> {
    readonly [Float2.x] = Types.F32;
    readonly [Float2.y] = Types.F32;
}


export class VelocityType implements Component<Float2> {
    readonly [Float2.x] = Types.F32;
    readonly [Float2.y] = Types.F32;
}

/** 标记由本示例创建、重开游戏时需要统一销毁的实体。 */
export class GameEntityType implements ComponentTag { }
