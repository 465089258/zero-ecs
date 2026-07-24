import { DEFAULT_EPSILON } from "../angle";
import {
    Aabb3,
    Plane3,
    Ray3,
    Sphere3,
    type Aabb3Columns,
    type ReadonlyAabb3Columns,
    type ReadonlyPlane3Columns,
    type ReadonlyRay3Columns,
    type ReadonlySphere3Columns,
} from "./components";

export function setAabb3(
    output: Aabb3Columns,
    row: number,
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
): void {
    output[Aabb3.MinX][row] = minX;
    output[Aabb3.MinY][row] = minY;
    output[Aabb3.MinZ][row] = minZ;
    output[Aabb3.MaxX][row] = maxX;
    output[Aabb3.MaxY][row] = maxY;
    output[Aabb3.MaxZ][row] = maxZ;
}

export function containsPointAabb3(
    aabb: ReadonlyAabb3Columns,
    row: number,
    x: number,
    y: number,
    z: number,
): boolean {
    return x >= aabb[Aabb3.MinX][row] &&
        x <= aabb[Aabb3.MaxX][row] &&
        y >= aabb[Aabb3.MinY][row] &&
        y <= aabb[Aabb3.MaxY][row] &&
        z >= aabb[Aabb3.MinZ][row] &&
        z <= aabb[Aabb3.MaxZ][row];
}

export function intersectsAabb3(
    left: ReadonlyAabb3Columns,
    leftRow: number,
    right: ReadonlyAabb3Columns,
    rightRow: number,
): boolean {
    return left[Aabb3.MinX][leftRow] <= right[Aabb3.MaxX][rightRow] &&
        left[Aabb3.MaxX][leftRow] >= right[Aabb3.MinX][rightRow] &&
        left[Aabb3.MinY][leftRow] <= right[Aabb3.MaxY][rightRow] &&
        left[Aabb3.MaxY][leftRow] >= right[Aabb3.MinY][rightRow] &&
        left[Aabb3.MinZ][leftRow] <= right[Aabb3.MaxZ][rightRow] &&
        left[Aabb3.MaxZ][leftRow] >= right[Aabb3.MinZ][rightRow];
}

export function intersectsSphereAabb3(
    sphere: ReadonlySphere3Columns,
    sphereRow: number,
    aabb: ReadonlyAabb3Columns,
    aabbRow: number,
): boolean {
    const centerX = sphere[Sphere3.CenterX][sphereRow];
    const centerY = sphere[Sphere3.CenterY][sphereRow];
    const centerZ = sphere[Sphere3.CenterZ][sphereRow];
    const radius = sphere[Sphere3.Radius][sphereRow];
    const nearestX = Math.max(
        aabb[Aabb3.MinX][aabbRow],
        Math.min(centerX, aabb[Aabb3.MaxX][aabbRow]),
    );
    const nearestY = Math.max(
        aabb[Aabb3.MinY][aabbRow],
        Math.min(centerY, aabb[Aabb3.MaxY][aabbRow]),
    );
    const nearestZ = Math.max(
        aabb[Aabb3.MinZ][aabbRow],
        Math.min(centerZ, aabb[Aabb3.MaxZ][aabbRow]),
    );
    const dx = centerX - nearestX;
    const dy = centerY - nearestY;
    const dz = centerZ - nearestZ;
    return dx * dx + dy * dy + dz * dz <= radius * radius;
}

export function intersectsSphere3(
    left: ReadonlySphere3Columns,
    leftRow: number,
    right: ReadonlySphere3Columns,
    rightRow: number,
): boolean {
    const dx = left[Sphere3.CenterX][leftRow] -
        right[Sphere3.CenterX][rightRow];
    const dy = left[Sphere3.CenterY][leftRow] -
        right[Sphere3.CenterY][rightRow];
    const dz = left[Sphere3.CenterZ][leftRow] -
        right[Sphere3.CenterZ][rightRow];
    const radius = left[Sphere3.Radius][leftRow] +
        right[Sphere3.Radius][rightRow];
    return dx * dx + dy * dy + dz * dz <= radius * radius;
}

export function signedDistanceToPlane3(
    plane: ReadonlyPlane3Columns,
    row: number,
    x: number,
    y: number,
    z: number,
): number {
    return plane[Plane3.NormalX][row] * x +
        plane[Plane3.NormalY][row] * y +
        plane[Plane3.NormalZ][row] * z +
        plane[Plane3.Distance][row];
}

/**
 * 返回射线与平面的非负距离；平行或交点位于射线反方向时返回 NaN。
 */
export function intersectRayPlane3(
    ray: ReadonlyRay3Columns,
    rayRow: number,
    plane: ReadonlyPlane3Columns,
    planeRow: number,
    epsilon = DEFAULT_EPSILON,
): number {
    const directionX = ray[Ray3.DirectionX][rayRow];
    const directionY = ray[Ray3.DirectionY][rayRow];
    const directionZ = ray[Ray3.DirectionZ][rayRow];
    const denominator = plane[Plane3.NormalX][planeRow] * directionX +
        plane[Plane3.NormalY][planeRow] * directionY +
        plane[Plane3.NormalZ][planeRow] * directionZ;
    if (Math.abs(denominator) <= epsilon) return Number.NaN;
    const distance = -signedDistanceToPlane3(
        plane,
        planeRow,
        ray[Ray3.OriginX][rayRow],
        ray[Ray3.OriginY][rayRow],
        ray[Ray3.OriginZ][rayRow],
    ) / denominator;
    return distance >= 0 ? distance : Number.NaN;
}
