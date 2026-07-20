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

export class GameEntityType implements Component<never> {}
