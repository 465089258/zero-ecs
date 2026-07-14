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

export const enum Ball { radius, active }
export class BallType implements Component<Ball> {
    readonly [Ball.radius] = Types.F32;
    readonly [Ball.active] = Types.U8;
}

export const enum Paddle { halfWidth, halfHeight }
export class PaddleType implements Component<Paddle> {
    readonly [Paddle.halfWidth] = Types.F32;
    readonly [Paddle.halfHeight] = Types.F32;
}

export const enum Brick { halfWidth, halfHeight, color, active }
export class BrickType implements Component<Brick> {
    readonly [Brick.halfWidth] = Types.F32;
    readonly [Brick.halfHeight] = Types.F32;
    readonly [Brick.color] = Types.U8;
    readonly [Brick.active] = Types.U8;
}

export const enum PowerUp { radius, active }
export class PowerUpType implements Component<PowerUp> {
    readonly [PowerUp.radius] = Types.F32;
    readonly [PowerUp.active] = Types.U8;
}

/** Marker used by the restart system to clear only example-owned entities. */
export class GameEntityType implements Component<never> {}
