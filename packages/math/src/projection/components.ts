import {
    Types,
    type Component,
    type ComponentTag,
} from "@zero-ecs/game";
import { Aabb3Type } from "../3d/components";

/** 斜俯视相机朝向；角度单位均为弧度。 */
export enum TopDownCamera3 {
    Yaw,
    Elevation,
}

/**
 * 正交相机参数。
 *
 * Near/Far 是从相机位置沿 Forward 方向计算的相机空间深度；CullingMargin 使用世界单位。
 */
export enum OrthographicCamera {
    ViewportWidth,
    ViewportHeight,
    PixelsPerUnit,
    Near,
    Far,
    CullingMargin,
}

/** 从斜俯视朝向派生并供投影热路径直接读取的正交相机基向量。 */
export enum CameraBasis3 {
    RightX,
    RightY,
    RightZ,
    UpX,
    UpY,
    UpZ,
    ForwardX,
    ForwardY,
    ForwardZ,
}

/** 实体参与相机裁剪时使用的世界空间包围球半径。 */
export enum ProjectionBounds3 {
    Radius,
}

/**
 * 3D 世界点的持久 2D 投影结果。
 *
 * 实体不可见时 System 只把 Visible 写为 0，X/Y/Depth 保留最近一次有效结果。
 */
export enum Projected2 {
    X,
    Y,
    Depth,
    Visible,
}

export class TopDownCamera3Type implements Component<TopDownCamera3> {
    readonly [TopDownCamera3.Yaw] = Types.F32;
    readonly [TopDownCamera3.Elevation] = Types.F32;
}

export class OrthographicCameraType implements Component<OrthographicCamera> {
    readonly [OrthographicCamera.ViewportWidth] = Types.F32;
    readonly [OrthographicCamera.ViewportHeight] = Types.F32;
    readonly [OrthographicCamera.PixelsPerUnit] = Types.F32;
    readonly [OrthographicCamera.Near] = Types.F32;
    readonly [OrthographicCamera.Far] = Types.F32;
    readonly [OrthographicCamera.CullingMargin] = Types.F32;
}

export class CameraBasis3Type implements Component<CameraBasis3> {
    readonly [CameraBasis3.RightX] = Types.F32;
    readonly [CameraBasis3.RightY] = Types.F32;
    readonly [CameraBasis3.RightZ] = Types.F32;
    readonly [CameraBasis3.UpX] = Types.F32;
    readonly [CameraBasis3.UpY] = Types.F32;
    readonly [CameraBasis3.UpZ] = Types.F32;
    readonly [CameraBasis3.ForwardX] = Types.F32;
    readonly [CameraBasis3.ForwardY] = Types.F32;
    readonly [CameraBasis3.ForwardZ] = Types.F32;
}

/** 当前相机正交视体在世界坐标中的粗裁剪 AABB。 */
export class CameraWorldAabb3Type extends Aabb3Type {}

/** 标记唯一参与当前 Projection System 的相机。 */
export class ActiveCameraTag implements ComponentTag {}

export class ProjectionBounds3Type implements Component<ProjectionBounds3> {
    readonly [ProjectionBounds3.Radius] = Types.F32;
}

export class Projected2Type implements Component<Projected2> {
    readonly [Projected2.X] = Types.F32;
    readonly [Projected2.Y] = Types.F32;
    readonly [Projected2.Depth] = Types.F32;
    readonly [Projected2.Visible] = Types.U8;
}
