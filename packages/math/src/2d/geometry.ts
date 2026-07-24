import {
    Aabb2,
    Circle2,
    type Aabb2Columns,
    type ReadonlyAabb2Columns,
    type ReadonlyCircle2Columns,
} from "./components";

export function setAabb2(
    output: Aabb2Columns,
    row: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
): void {
    output[Aabb2.MinX][row] = minX;
    output[Aabb2.MinY][row] = minY;
    output[Aabb2.MaxX][row] = maxX;
    output[Aabb2.MaxY][row] = maxY;
}

export function containsPointAabb2(
    aabb: ReadonlyAabb2Columns,
    row: number,
    x: number,
    y: number,
): boolean {
    return x >= aabb[Aabb2.MinX][row] &&
        x <= aabb[Aabb2.MaxX][row] &&
        y >= aabb[Aabb2.MinY][row] &&
        y <= aabb[Aabb2.MaxY][row];
}

export function intersectsAabb2(
    left: ReadonlyAabb2Columns,
    leftRow: number,
    right: ReadonlyAabb2Columns,
    rightRow: number,
): boolean {
    return left[Aabb2.MinX][leftRow] <= right[Aabb2.MaxX][rightRow] &&
        left[Aabb2.MaxX][leftRow] >= right[Aabb2.MinX][rightRow] &&
        left[Aabb2.MinY][leftRow] <= right[Aabb2.MaxY][rightRow] &&
        left[Aabb2.MaxY][leftRow] >= right[Aabb2.MinY][rightRow];
}

export function intersectsCircleAabb2(
    circle: ReadonlyCircle2Columns,
    circleRow: number,
    aabb: ReadonlyAabb2Columns,
    aabbRow: number,
): boolean {
    const centerX = circle[Circle2.CenterX][circleRow];
    const centerY = circle[Circle2.CenterY][circleRow];
    const radius = circle[Circle2.Radius][circleRow];
    const nearestX = Math.max(
        aabb[Aabb2.MinX][aabbRow],
        Math.min(centerX, aabb[Aabb2.MaxX][aabbRow]),
    );
    const nearestY = Math.max(
        aabb[Aabb2.MinY][aabbRow],
        Math.min(centerY, aabb[Aabb2.MaxY][aabbRow]),
    );
    const dx = centerX - nearestX;
    const dy = centerY - nearestY;
    return dx * dx + dy * dy <= radius * radius;
}
