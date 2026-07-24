import { Types, type Component } from "@zero-ecs/game";

/** 以弧度保存的角度字段。 */
export enum Angle {
    Radians,
}

/** 以弧度/秒保存的角速度字段。 */
export enum AngularVelocity {
    RadiansPerSecond,
}

/** 可跨越多个圆周的连续相位。 */
export class AngularPhaseType implements Component<Angle> {
    readonly [Angle.Radians] = Types.F32;
}

export const PI = Math.PI;
export const HALF_TURN = Math.PI;
export const FULL_TURN = Math.PI * 2;
export const HALF_PI = Math.PI * 0.5;
export const DEFAULT_EPSILON = 1e-6;

/** 把任意弧度规范化到 [0, 2π)。 */
export function wrapRadians(radians: number): number {
    const wrapped = radians % FULL_TURN;
    return wrapped < 0 ? wrapped + FULL_TURN : wrapped;
}

/** 返回从 from 到 to 的最短有符号圆弧，范围为 [-π, π)。 */
export function shortestAngleDelta(from: number, to: number): number {
    let delta = (to - from + Math.PI) % FULL_TURN;
    if (delta < 0) delta += FULL_TURN;
    return delta - Math.PI;
}

/** 沿最短圆弧插值，alpha 不会被自动限制。 */
export function lerpAngle(from: number, to: number, alpha: number): number {
    return wrapRadians(from + shortestAngleDelta(from, to) * alpha);
}

export function degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
}

export function radiansToDegrees(radians: number): number {
    return radians * 180 / Math.PI;
}

export function clamp(value: number, minimum: number, maximum: number): number {
    return value < minimum ? minimum : value > maximum ? maximum : value;
}

export function lerp(from: number, to: number, alpha: number): number {
    return from + (to - from) * alpha;
}
