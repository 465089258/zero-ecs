import { DEFAULT_EPSILON } from "../angle";
import {
    Float2,
    type Float2Columns,
    type ReadonlyFloat2Columns,
} from "./components";

export function setFloat2(
    output: Float2Columns,
    outputRow: number,
    x: number,
    y: number,
): void {
    output[Float2.X][outputRow] = x;
    output[Float2.Y][outputRow] = y;
}

export function copyFloat2(
    source: ReadonlyFloat2Columns,
    sourceRow: number,
    output: Float2Columns,
    outputRow: number,
): void {
    const x = source[Float2.X][sourceRow];
    const y = source[Float2.Y][sourceRow];
    output[Float2.X][outputRow] = x;
    output[Float2.Y][outputRow] = y;
}

export function addFloat2(
    left: ReadonlyFloat2Columns,
    leftRow: number,
    right: ReadonlyFloat2Columns,
    rightRow: number,
    output: Float2Columns,
    outputRow: number,
): void {
    const x = left[Float2.X][leftRow] + right[Float2.X][rightRow];
    const y = left[Float2.Y][leftRow] + right[Float2.Y][rightRow];
    output[Float2.X][outputRow] = x;
    output[Float2.Y][outputRow] = y;
}

export function subtractFloat2(
    left: ReadonlyFloat2Columns,
    leftRow: number,
    right: ReadonlyFloat2Columns,
    rightRow: number,
    output: Float2Columns,
    outputRow: number,
): void {
    const x = left[Float2.X][leftRow] - right[Float2.X][rightRow];
    const y = left[Float2.Y][leftRow] - right[Float2.Y][rightRow];
    output[Float2.X][outputRow] = x;
    output[Float2.Y][outputRow] = y;
}

export function scaleFloat2(
    source: ReadonlyFloat2Columns,
    sourceRow: number,
    scalar: number,
    output: Float2Columns,
    outputRow: number,
): void {
    const x = source[Float2.X][sourceRow] * scalar;
    const y = source[Float2.Y][sourceRow] * scalar;
    output[Float2.X][outputRow] = x;
    output[Float2.Y][outputRow] = y;
}

export function dotFloat2(
    left: ReadonlyFloat2Columns,
    leftRow: number,
    right: ReadonlyFloat2Columns,
    rightRow: number,
): number {
    return left[Float2.X][leftRow] * right[Float2.X][rightRow] +
        left[Float2.Y][leftRow] * right[Float2.Y][rightRow];
}

/** 返回二维叉积的 Z 分量。 */
export function crossFloat2(
    left: ReadonlyFloat2Columns,
    leftRow: number,
    right: ReadonlyFloat2Columns,
    rightRow: number,
): number {
    return left[Float2.X][leftRow] * right[Float2.Y][rightRow] -
        left[Float2.Y][leftRow] * right[Float2.X][rightRow];
}

export function lengthSquaredFloat2(
    source: ReadonlyFloat2Columns,
    row: number,
): number {
    const x = source[Float2.X][row];
    const y = source[Float2.Y][row];
    return x * x + y * y;
}

export function lengthFloat2(
    source: ReadonlyFloat2Columns,
    row: number,
): number {
    return Math.sqrt(lengthSquaredFloat2(source, row));
}

export function distanceSquaredFloat2(
    left: ReadonlyFloat2Columns,
    leftRow: number,
    right: ReadonlyFloat2Columns,
    rightRow: number,
): number {
    const x = left[Float2.X][leftRow] - right[Float2.X][rightRow];
    const y = left[Float2.Y][leftRow] - right[Float2.Y][rightRow];
    return x * x + y * y;
}

export function distanceFloat2(
    left: ReadonlyFloat2Columns,
    leftRow: number,
    right: ReadonlyFloat2Columns,
    rightRow: number,
): number {
    return Math.sqrt(distanceSquaredFloat2(left, leftRow, right, rightRow));
}

/**
 * 规范化并返回输入长度。接近零时写入零向量并返回 0。
 *
 * 输入和输出可以指向相同组件列和行。
 */
export function normalizeFloat2(
    source: ReadonlyFloat2Columns,
    sourceRow: number,
    output: Float2Columns,
    outputRow: number,
    epsilon = DEFAULT_EPSILON,
): number {
    const x = source[Float2.X][sourceRow];
    const y = source[Float2.Y][sourceRow];
    const length = Math.sqrt(x * x + y * y);
    if (length <= epsilon) {
        output[Float2.X][outputRow] = 0;
        output[Float2.Y][outputRow] = 0;
        return 0;
    }
    const inverse = 1 / length;
    output[Float2.X][outputRow] = x * inverse;
    output[Float2.Y][outputRow] = y * inverse;
    return length;
}

export function lerpFloat2(
    from: ReadonlyFloat2Columns,
    fromRow: number,
    to: ReadonlyFloat2Columns,
    toRow: number,
    alpha: number,
    output: Float2Columns,
    outputRow: number,
): void {
    const fromX = from[Float2.X][fromRow];
    const fromY = from[Float2.Y][fromRow];
    const toX = to[Float2.X][toRow];
    const toY = to[Float2.Y][toRow];
    output[Float2.X][outputRow] = fromX + (toX - fromX) * alpha;
    output[Float2.Y][outputRow] = fromY + (toY - fromY) * alpha;
}

export function rotateFloat2(
    source: ReadonlyFloat2Columns,
    sourceRow: number,
    radians: number,
    output: Float2Columns,
    outputRow: number,
): void {
    const x = source[Float2.X][sourceRow];
    const y = source[Float2.Y][sourceRow];
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    output[Float2.X][outputRow] = x * cosine - y * sine;
    output[Float2.Y][outputRow] = x * sine + y * cosine;
}
