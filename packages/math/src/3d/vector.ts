import { DEFAULT_EPSILON } from "../angle";
import {
    Float3,
    type Float3Columns,
    type ReadonlyFloat3Columns,
} from "./components";

export function setFloat3(
    output: Float3Columns,
    outputRow: number,
    x: number,
    y: number,
    z: number,
): void {
    output[Float3.X][outputRow] = x;
    output[Float3.Y][outputRow] = y;
    output[Float3.Z][outputRow] = z;
}

export function copyFloat3(
    source: ReadonlyFloat3Columns,
    sourceRow: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const x = source[Float3.X][sourceRow];
    const y = source[Float3.Y][sourceRow];
    const z = source[Float3.Z][sourceRow];
    output[Float3.X][outputRow] = x;
    output[Float3.Y][outputRow] = y;
    output[Float3.Z][outputRow] = z;
}

export function addFloat3(
    left: ReadonlyFloat3Columns,
    leftRow: number,
    right: ReadonlyFloat3Columns,
    rightRow: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const x = left[Float3.X][leftRow] + right[Float3.X][rightRow];
    const y = left[Float3.Y][leftRow] + right[Float3.Y][rightRow];
    const z = left[Float3.Z][leftRow] + right[Float3.Z][rightRow];
    output[Float3.X][outputRow] = x;
    output[Float3.Y][outputRow] = y;
    output[Float3.Z][outputRow] = z;
}

export function subtractFloat3(
    left: ReadonlyFloat3Columns,
    leftRow: number,
    right: ReadonlyFloat3Columns,
    rightRow: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const x = left[Float3.X][leftRow] - right[Float3.X][rightRow];
    const y = left[Float3.Y][leftRow] - right[Float3.Y][rightRow];
    const z = left[Float3.Z][leftRow] - right[Float3.Z][rightRow];
    output[Float3.X][outputRow] = x;
    output[Float3.Y][outputRow] = y;
    output[Float3.Z][outputRow] = z;
}

export function scaleFloat3(
    source: ReadonlyFloat3Columns,
    sourceRow: number,
    scalar: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const x = source[Float3.X][sourceRow] * scalar;
    const y = source[Float3.Y][sourceRow] * scalar;
    const z = source[Float3.Z][sourceRow] * scalar;
    output[Float3.X][outputRow] = x;
    output[Float3.Y][outputRow] = y;
    output[Float3.Z][outputRow] = z;
}

export function dotFloat3(
    left: ReadonlyFloat3Columns,
    leftRow: number,
    right: ReadonlyFloat3Columns,
    rightRow: number,
): number {
    return left[Float3.X][leftRow] * right[Float3.X][rightRow] +
        left[Float3.Y][leftRow] * right[Float3.Y][rightRow] +
        left[Float3.Z][leftRow] * right[Float3.Z][rightRow];
}

export function crossFloat3(
    left: ReadonlyFloat3Columns,
    leftRow: number,
    right: ReadonlyFloat3Columns,
    rightRow: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const leftX = left[Float3.X][leftRow];
    const leftY = left[Float3.Y][leftRow];
    const leftZ = left[Float3.Z][leftRow];
    const rightX = right[Float3.X][rightRow];
    const rightY = right[Float3.Y][rightRow];
    const rightZ = right[Float3.Z][rightRow];
    output[Float3.X][outputRow] = leftY * rightZ - leftZ * rightY;
    output[Float3.Y][outputRow] = leftZ * rightX - leftX * rightZ;
    output[Float3.Z][outputRow] = leftX * rightY - leftY * rightX;
}

export function lengthSquaredFloat3(
    source: ReadonlyFloat3Columns,
    row: number,
): number {
    const x = source[Float3.X][row];
    const y = source[Float3.Y][row];
    const z = source[Float3.Z][row];
    return x * x + y * y + z * z;
}

export function lengthFloat3(
    source: ReadonlyFloat3Columns,
    row: number,
): number {
    return Math.sqrt(lengthSquaredFloat3(source, row));
}

export function distanceSquaredFloat3(
    left: ReadonlyFloat3Columns,
    leftRow: number,
    right: ReadonlyFloat3Columns,
    rightRow: number,
): number {
    const x = left[Float3.X][leftRow] - right[Float3.X][rightRow];
    const y = left[Float3.Y][leftRow] - right[Float3.Y][rightRow];
    const z = left[Float3.Z][leftRow] - right[Float3.Z][rightRow];
    return x * x + y * y + z * z;
}

export function distanceFloat3(
    left: ReadonlyFloat3Columns,
    leftRow: number,
    right: ReadonlyFloat3Columns,
    rightRow: number,
): number {
    return Math.sqrt(distanceSquaredFloat3(left, leftRow, right, rightRow));
}

/**
 * 规范化并返回输入长度。接近零时写入零向量并返回 0。
 *
 * 输入和输出可以指向相同组件列和行。
 */
export function normalizeFloat3(
    source: ReadonlyFloat3Columns,
    sourceRow: number,
    output: Float3Columns,
    outputRow: number,
    epsilon = DEFAULT_EPSILON,
): number {
    const x = source[Float3.X][sourceRow];
    const y = source[Float3.Y][sourceRow];
    const z = source[Float3.Z][sourceRow];
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length <= epsilon) {
        output[Float3.X][outputRow] = 0;
        output[Float3.Y][outputRow] = 0;
        output[Float3.Z][outputRow] = 0;
        return 0;
    }
    const inverse = 1 / length;
    output[Float3.X][outputRow] = x * inverse;
    output[Float3.Y][outputRow] = y * inverse;
    output[Float3.Z][outputRow] = z * inverse;
    return length;
}

export function lerpFloat3(
    from: ReadonlyFloat3Columns,
    fromRow: number,
    to: ReadonlyFloat3Columns,
    toRow: number,
    alpha: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const fromX = from[Float3.X][fromRow];
    const fromY = from[Float3.Y][fromRow];
    const fromZ = from[Float3.Z][fromRow];
    const toX = to[Float3.X][toRow];
    const toY = to[Float3.Y][toRow];
    const toZ = to[Float3.Z][toRow];
    output[Float3.X][outputRow] = fromX + (toX - fromX) * alpha;
    output[Float3.Y][outputRow] = fromY + (toY - fromY) * alpha;
    output[Float3.Z][outputRow] = fromZ + (toZ - fromZ) * alpha;
}
