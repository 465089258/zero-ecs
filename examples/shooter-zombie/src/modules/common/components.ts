import { Types, type Component } from "zero-ecs-lib";

export const enum Position { x, y }

export class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

export const enum Velocity { x, y }

export class VelocityType implements Component<Velocity> {
    readonly [Velocity.x] = Types.F32;
    readonly [Velocity.y] = Types.F32;
}

/** 标记由本示例创建、重开游戏时需要统一销毁的实体。 */
export class GameEntityType implements Component<never> {}
