import { Types, type Component } from "@zero-ecs/game";
import {
    Angle,
    AngularVelocity,
} from "../angle";
import type { ReadonlyNumberColumn } from "../columns";

/** 二维 F32 坐标布局。 */
export enum Float2 {
    X,
    Y,
}

/** 3×3 F32 矩阵布局；字段名使用行、列顺序。 */
export enum Float3x3 {
    M00,
    M01,
    M02,
    M10,
    M11,
    M12,
    M20,
    M21,
    M22,
}

export enum Aabb2 {
    MinX,
    MinY,
    MaxX,
    MaxY,
}

export enum Circle2 {
    CenterX,
    CenterY,
    Radius,
}

export interface ReadonlyFloat2Columns {
    readonly [Float2.X]: ReadonlyNumberColumn;
    readonly [Float2.Y]: ReadonlyNumberColumn;
}

export interface Float2Columns {
    readonly [Float2.X]: Float32Array;
    readonly [Float2.Y]: Float32Array;
}

export interface ReadonlyFloat3x3Columns {
    readonly [Float3x3.M00]: ReadonlyNumberColumn;
    readonly [Float3x3.M01]: ReadonlyNumberColumn;
    readonly [Float3x3.M02]: ReadonlyNumberColumn;
    readonly [Float3x3.M10]: ReadonlyNumberColumn;
    readonly [Float3x3.M11]: ReadonlyNumberColumn;
    readonly [Float3x3.M12]: ReadonlyNumberColumn;
    readonly [Float3x3.M20]: ReadonlyNumberColumn;
    readonly [Float3x3.M21]: ReadonlyNumberColumn;
    readonly [Float3x3.M22]: ReadonlyNumberColumn;
}

export interface Float3x3Columns {
    readonly [Float3x3.M00]: Float32Array;
    readonly [Float3x3.M01]: Float32Array;
    readonly [Float3x3.M02]: Float32Array;
    readonly [Float3x3.M10]: Float32Array;
    readonly [Float3x3.M11]: Float32Array;
    readonly [Float3x3.M12]: Float32Array;
    readonly [Float3x3.M20]: Float32Array;
    readonly [Float3x3.M21]: Float32Array;
    readonly [Float3x3.M22]: Float32Array;
}

export interface ReadonlyAabb2Columns {
    readonly [Aabb2.MinX]: ReadonlyNumberColumn;
    readonly [Aabb2.MinY]: ReadonlyNumberColumn;
    readonly [Aabb2.MaxX]: ReadonlyNumberColumn;
    readonly [Aabb2.MaxY]: ReadonlyNumberColumn;
}

export interface Aabb2Columns {
    readonly [Aabb2.MinX]: Float32Array;
    readonly [Aabb2.MinY]: Float32Array;
    readonly [Aabb2.MaxX]: Float32Array;
    readonly [Aabb2.MaxY]: Float32Array;
}

export interface ReadonlyCircle2Columns {
    readonly [Circle2.CenterX]: ReadonlyNumberColumn;
    readonly [Circle2.CenterY]: ReadonlyNumberColumn;
    readonly [Circle2.Radius]: ReadonlyNumberColumn;
}

export class Vector2Type implements Component<Float2> {
    readonly [Float2.X] = Types.F32;
    readonly [Float2.Y] = Types.F32;
}

export class Position2Type implements Component<Float2> {
    readonly [Float2.X] = Types.F32;
    readonly [Float2.Y] = Types.F32;
}

export class PreviousPosition2Type implements Component<Float2> {
    readonly [Float2.X] = Types.F32;
    readonly [Float2.Y] = Types.F32;
}

export class RenderPosition2Type implements Component<Float2> {
    readonly [Float2.X] = Types.F32;
    readonly [Float2.Y] = Types.F32;
}

export class Velocity2Type implements Component<Float2> {
    readonly [Float2.X] = Types.F32;
    readonly [Float2.Y] = Types.F32;
}

export class Acceleration2Type implements Component<Float2> {
    readonly [Float2.X] = Types.F32;
    readonly [Float2.Y] = Types.F32;
}

export class Direction2Type implements Component<Float2> {
    readonly [Float2.X] = Types.F32;
    readonly [Float2.Y] = Types.F32;
}

export class Scale2Type implements Component<Float2> {
    readonly [Float2.X] = Types.F32;
    readonly [Float2.Y] = Types.F32;
}

/** 规范方向角，存储单位为弧度。 */
export class Rotation2Type implements Component<Angle> {
    readonly [Angle.Radians] = Types.F32;
}

export class AngularVelocity2Type implements Component<AngularVelocity> {
    readonly [AngularVelocity.RadiansPerSecond] = Types.F32;
}

export class Matrix3Type implements Component<Float3x3> {
    readonly [Float3x3.M00] = Types.F32;
    readonly [Float3x3.M01] = Types.F32;
    readonly [Float3x3.M02] = Types.F32;
    readonly [Float3x3.M10] = Types.F32;
    readonly [Float3x3.M11] = Types.F32;
    readonly [Float3x3.M12] = Types.F32;
    readonly [Float3x3.M20] = Types.F32;
    readonly [Float3x3.M21] = Types.F32;
    readonly [Float3x3.M22] = Types.F32;
}

export class LocalMatrix3Type implements Component<Float3x3> {
    readonly [Float3x3.M00] = Types.F32;
    readonly [Float3x3.M01] = Types.F32;
    readonly [Float3x3.M02] = Types.F32;
    readonly [Float3x3.M10] = Types.F32;
    readonly [Float3x3.M11] = Types.F32;
    readonly [Float3x3.M12] = Types.F32;
    readonly [Float3x3.M20] = Types.F32;
    readonly [Float3x3.M21] = Types.F32;
    readonly [Float3x3.M22] = Types.F32;
}

export class WorldMatrix3Type implements Component<Float3x3> {
    readonly [Float3x3.M00] = Types.F32;
    readonly [Float3x3.M01] = Types.F32;
    readonly [Float3x3.M02] = Types.F32;
    readonly [Float3x3.M10] = Types.F32;
    readonly [Float3x3.M11] = Types.F32;
    readonly [Float3x3.M12] = Types.F32;
    readonly [Float3x3.M20] = Types.F32;
    readonly [Float3x3.M21] = Types.F32;
    readonly [Float3x3.M22] = Types.F32;
}

export class Aabb2Type implements Component<Aabb2> {
    readonly [Aabb2.MinX] = Types.F32;
    readonly [Aabb2.MinY] = Types.F32;
    readonly [Aabb2.MaxX] = Types.F32;
    readonly [Aabb2.MaxY] = Types.F32;
}

export class Circle2Type implements Component<Circle2> {
    readonly [Circle2.CenterX] = Types.F32;
    readonly [Circle2.CenterY] = Types.F32;
    readonly [Circle2.Radius] = Types.F32;
}
