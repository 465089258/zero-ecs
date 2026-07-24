import { Types, type Component } from "@zero-ecs/game";
import type { ReadonlyNumberColumn } from "../columns";

/** 三维 F32 坐标布局。 */
export enum Float3 {
    X,
    Y,
    Z,
}

/** 四维 F32 坐标布局，四元数使用 X/Y/Z/W。 */
export enum Float4 {
    X,
    Y,
    Z,
    W,
}

/** 4×4 F32 矩阵布局；字段名使用行、列顺序。 */
export enum Float4x4 {
    M00,
    M01,
    M02,
    M03,
    M10,
    M11,
    M12,
    M13,
    M20,
    M21,
    M22,
    M23,
    M30,
    M31,
    M32,
    M33,
}

export enum Aabb3 {
    MinX,
    MinY,
    MinZ,
    MaxX,
    MaxY,
    MaxZ,
}

export enum Sphere3 {
    CenterX,
    CenterY,
    CenterZ,
    Radius,
}

export enum Plane3 {
    NormalX,
    NormalY,
    NormalZ,
    Distance,
}

export enum Ray3 {
    OriginX,
    OriginY,
    OriginZ,
    DirectionX,
    DirectionY,
    DirectionZ,
}

export interface ReadonlyFloat3Columns {
    readonly [Float3.X]: ReadonlyNumberColumn;
    readonly [Float3.Y]: ReadonlyNumberColumn;
    readonly [Float3.Z]: ReadonlyNumberColumn;
}

export interface Float3Columns {
    readonly [Float3.X]: Float32Array;
    readonly [Float3.Y]: Float32Array;
    readonly [Float3.Z]: Float32Array;
}

export interface ReadonlyFloat4Columns {
    readonly [Float4.X]: ReadonlyNumberColumn;
    readonly [Float4.Y]: ReadonlyNumberColumn;
    readonly [Float4.Z]: ReadonlyNumberColumn;
    readonly [Float4.W]: ReadonlyNumberColumn;
}

export interface Float4Columns {
    readonly [Float4.X]: Float32Array;
    readonly [Float4.Y]: Float32Array;
    readonly [Float4.Z]: Float32Array;
    readonly [Float4.W]: Float32Array;
}

export interface ReadonlyFloat4x4Columns {
    readonly [Float4x4.M00]: ReadonlyNumberColumn;
    readonly [Float4x4.M01]: ReadonlyNumberColumn;
    readonly [Float4x4.M02]: ReadonlyNumberColumn;
    readonly [Float4x4.M03]: ReadonlyNumberColumn;
    readonly [Float4x4.M10]: ReadonlyNumberColumn;
    readonly [Float4x4.M11]: ReadonlyNumberColumn;
    readonly [Float4x4.M12]: ReadonlyNumberColumn;
    readonly [Float4x4.M13]: ReadonlyNumberColumn;
    readonly [Float4x4.M20]: ReadonlyNumberColumn;
    readonly [Float4x4.M21]: ReadonlyNumberColumn;
    readonly [Float4x4.M22]: ReadonlyNumberColumn;
    readonly [Float4x4.M23]: ReadonlyNumberColumn;
    readonly [Float4x4.M30]: ReadonlyNumberColumn;
    readonly [Float4x4.M31]: ReadonlyNumberColumn;
    readonly [Float4x4.M32]: ReadonlyNumberColumn;
    readonly [Float4x4.M33]: ReadonlyNumberColumn;
}

export interface Float4x4Columns {
    readonly [Float4x4.M00]: Float32Array;
    readonly [Float4x4.M01]: Float32Array;
    readonly [Float4x4.M02]: Float32Array;
    readonly [Float4x4.M03]: Float32Array;
    readonly [Float4x4.M10]: Float32Array;
    readonly [Float4x4.M11]: Float32Array;
    readonly [Float4x4.M12]: Float32Array;
    readonly [Float4x4.M13]: Float32Array;
    readonly [Float4x4.M20]: Float32Array;
    readonly [Float4x4.M21]: Float32Array;
    readonly [Float4x4.M22]: Float32Array;
    readonly [Float4x4.M23]: Float32Array;
    readonly [Float4x4.M30]: Float32Array;
    readonly [Float4x4.M31]: Float32Array;
    readonly [Float4x4.M32]: Float32Array;
    readonly [Float4x4.M33]: Float32Array;
}

export interface ReadonlyAabb3Columns {
    readonly [Aabb3.MinX]: ReadonlyNumberColumn;
    readonly [Aabb3.MinY]: ReadonlyNumberColumn;
    readonly [Aabb3.MinZ]: ReadonlyNumberColumn;
    readonly [Aabb3.MaxX]: ReadonlyNumberColumn;
    readonly [Aabb3.MaxY]: ReadonlyNumberColumn;
    readonly [Aabb3.MaxZ]: ReadonlyNumberColumn;
}

export interface Aabb3Columns {
    readonly [Aabb3.MinX]: Float32Array;
    readonly [Aabb3.MinY]: Float32Array;
    readonly [Aabb3.MinZ]: Float32Array;
    readonly [Aabb3.MaxX]: Float32Array;
    readonly [Aabb3.MaxY]: Float32Array;
    readonly [Aabb3.MaxZ]: Float32Array;
}

export interface ReadonlySphere3Columns {
    readonly [Sphere3.CenterX]: ReadonlyNumberColumn;
    readonly [Sphere3.CenterY]: ReadonlyNumberColumn;
    readonly [Sphere3.CenterZ]: ReadonlyNumberColumn;
    readonly [Sphere3.Radius]: ReadonlyNumberColumn;
}

export interface Sphere3Columns {
    readonly [Sphere3.CenterX]: Float32Array;
    readonly [Sphere3.CenterY]: Float32Array;
    readonly [Sphere3.CenterZ]: Float32Array;
    readonly [Sphere3.Radius]: Float32Array;
}

export interface ReadonlyPlane3Columns {
    readonly [Plane3.NormalX]: ReadonlyNumberColumn;
    readonly [Plane3.NormalY]: ReadonlyNumberColumn;
    readonly [Plane3.NormalZ]: ReadonlyNumberColumn;
    readonly [Plane3.Distance]: ReadonlyNumberColumn;
}

export interface Plane3Columns {
    readonly [Plane3.NormalX]: Float32Array;
    readonly [Plane3.NormalY]: Float32Array;
    readonly [Plane3.NormalZ]: Float32Array;
    readonly [Plane3.Distance]: Float32Array;
}

export interface ReadonlyRay3Columns {
    readonly [Ray3.OriginX]: ReadonlyNumberColumn;
    readonly [Ray3.OriginY]: ReadonlyNumberColumn;
    readonly [Ray3.OriginZ]: ReadonlyNumberColumn;
    readonly [Ray3.DirectionX]: ReadonlyNumberColumn;
    readonly [Ray3.DirectionY]: ReadonlyNumberColumn;
    readonly [Ray3.DirectionZ]: ReadonlyNumberColumn;
}

export interface Ray3Columns {
    readonly [Ray3.OriginX]: Float32Array;
    readonly [Ray3.OriginY]: Float32Array;
    readonly [Ray3.OriginZ]: Float32Array;
    readonly [Ray3.DirectionX]: Float32Array;
    readonly [Ray3.DirectionY]: Float32Array;
    readonly [Ray3.DirectionZ]: Float32Array;
}

export class Vector3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
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

export class RenderPosition3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class LocalPosition3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class WorldPosition3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class Velocity3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class Acceleration3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class Direction3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class Scale3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class AngularVelocity3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class QuaternionType implements Component<Float4> {
    readonly [Float4.X] = Types.F32;
    readonly [Float4.Y] = Types.F32;
    readonly [Float4.Z] = Types.F32;
    readonly [Float4.W] = Types.F32;
}

export class Rotation3Type implements Component<Float4> {
    readonly [Float4.X] = Types.F32;
    readonly [Float4.Y] = Types.F32;
    readonly [Float4.Z] = Types.F32;
    readonly [Float4.W] = Types.F32;
}

export class Matrix4Type implements Component<Float4x4> {
    readonly [Float4x4.M00] = Types.F32;
    readonly [Float4x4.M01] = Types.F32;
    readonly [Float4x4.M02] = Types.F32;
    readonly [Float4x4.M03] = Types.F32;
    readonly [Float4x4.M10] = Types.F32;
    readonly [Float4x4.M11] = Types.F32;
    readonly [Float4x4.M12] = Types.F32;
    readonly [Float4x4.M13] = Types.F32;
    readonly [Float4x4.M20] = Types.F32;
    readonly [Float4x4.M21] = Types.F32;
    readonly [Float4x4.M22] = Types.F32;
    readonly [Float4x4.M23] = Types.F32;
    readonly [Float4x4.M30] = Types.F32;
    readonly [Float4x4.M31] = Types.F32;
    readonly [Float4x4.M32] = Types.F32;
    readonly [Float4x4.M33] = Types.F32;
}

export class LocalMatrix4Type extends Matrix4Type {}
export class WorldMatrix4Type extends Matrix4Type {}
export class ViewMatrix4Type extends Matrix4Type {}
export class ProjectionMatrix4Type extends Matrix4Type {}
export class ViewProjectionMatrix4Type extends Matrix4Type {}

export class Aabb3Type implements Component<Aabb3> {
    readonly [Aabb3.MinX] = Types.F32;
    readonly [Aabb3.MinY] = Types.F32;
    readonly [Aabb3.MinZ] = Types.F32;
    readonly [Aabb3.MaxX] = Types.F32;
    readonly [Aabb3.MaxY] = Types.F32;
    readonly [Aabb3.MaxZ] = Types.F32;
}

export class Sphere3Type implements Component<Sphere3> {
    readonly [Sphere3.CenterX] = Types.F32;
    readonly [Sphere3.CenterY] = Types.F32;
    readonly [Sphere3.CenterZ] = Types.F32;
    readonly [Sphere3.Radius] = Types.F32;
}

export class Plane3Type implements Component<Plane3> {
    readonly [Plane3.NormalX] = Types.F32;
    readonly [Plane3.NormalY] = Types.F32;
    readonly [Plane3.NormalZ] = Types.F32;
    readonly [Plane3.Distance] = Types.F32;
}

export class Ray3Type implements Component<Ray3> {
    readonly [Ray3.OriginX] = Types.F32;
    readonly [Ray3.OriginY] = Types.F32;
    readonly [Ray3.OriginZ] = Types.F32;
    readonly [Ray3.DirectionX] = Types.F32;
    readonly [Ray3.DirectionY] = Types.F32;
    readonly [Ray3.DirectionZ] = Types.F32;
}
