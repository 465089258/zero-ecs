import { DEFAULT_EPSILON } from "../angle";
import {
    Float3,
    Float4,
    type Float3Columns,
    type Float4Columns,
    type ReadonlyFloat3Columns,
    type ReadonlyFloat4Columns,
} from "./components";

export function identityQuaternion(
    output: Float4Columns,
    row: number,
): void {
    output[Float4.X][row] = 0;
    output[Float4.Y][row] = 0;
    output[Float4.Z][row] = 0;
    output[Float4.W][row] = 1;
}

export function normalizeQuaternion(
    source: ReadonlyFloat4Columns,
    sourceRow: number,
    output: Float4Columns,
    outputRow: number,
    epsilon = DEFAULT_EPSILON,
): number {
    const x = source[Float4.X][sourceRow];
    const y = source[Float4.Y][sourceRow];
    const z = source[Float4.Z][sourceRow];
    const w = source[Float4.W][sourceRow];
    const length = Math.sqrt(x * x + y * y + z * z + w * w);
    if (length <= epsilon) {
        identityQuaternion(output, outputRow);
        return 0;
    }
    const inverse = 1 / length;
    output[Float4.X][outputRow] = x * inverse;
    output[Float4.Y][outputRow] = y * inverse;
    output[Float4.Z][outputRow] = z * inverse;
    output[Float4.W][outputRow] = w * inverse;
    return length;
}

/** Hamilton 积；output 可以与任一输入使用相同列和行。 */
export function multiplyQuaternion(
    left: ReadonlyFloat4Columns,
    leftRow: number,
    right: ReadonlyFloat4Columns,
    rightRow: number,
    output: Float4Columns,
    outputRow: number,
): void {
    const ax = left[Float4.X][leftRow];
    const ay = left[Float4.Y][leftRow];
    const az = left[Float4.Z][leftRow];
    const aw = left[Float4.W][leftRow];
    const bx = right[Float4.X][rightRow];
    const by = right[Float4.Y][rightRow];
    const bz = right[Float4.Z][rightRow];
    const bw = right[Float4.W][rightRow];
    output[Float4.X][outputRow] = aw * bx + ax * bw + ay * bz - az * by;
    output[Float4.Y][outputRow] = aw * by - ax * bz + ay * bw + az * bx;
    output[Float4.Z][outputRow] = aw * bz + ax * by - ay * bx + az * bw;
    output[Float4.W][outputRow] = aw * bw - ax * bx - ay * by - az * bz;
}

export function quaternionFromAxisAngle(
    axis: ReadonlyFloat3Columns,
    axisRow: number,
    radians: number,
    output: Float4Columns,
    outputRow: number,
    epsilon = DEFAULT_EPSILON,
): void {
    const axisX = axis[Float3.X][axisRow];
    const axisY = axis[Float3.Y][axisRow];
    const axisZ = axis[Float3.Z][axisRow];
    const axisLength = Math.sqrt(
        axisX * axisX + axisY * axisY + axisZ * axisZ,
    );
    if (axisLength <= epsilon) {
        identityQuaternion(output, outputRow);
        return;
    }
    const half = radians * 0.5;
    const scale = Math.sin(half) / axisLength;
    output[Float4.X][outputRow] = axisX * scale;
    output[Float4.Y][outputRow] = axisY * scale;
    output[Float4.Z][outputRow] = axisZ * scale;
    output[Float4.W][outputRow] = Math.cos(half);
}

/** 沿最短四元数圆弧插值；输入应为单位四元数。 */
export function slerpQuaternion(
    from: ReadonlyFloat4Columns,
    fromRow: number,
    to: ReadonlyFloat4Columns,
    toRow: number,
    alpha: number,
    output: Float4Columns,
    outputRow: number,
): void {
    const fromX = from[Float4.X][fromRow];
    const fromY = from[Float4.Y][fromRow];
    const fromZ = from[Float4.Z][fromRow];
    const fromW = from[Float4.W][fromRow];
    let toX = to[Float4.X][toRow];
    let toY = to[Float4.Y][toRow];
    let toZ = to[Float4.Z][toRow];
    let toW = to[Float4.W][toRow];
    let cosine = fromX * toX + fromY * toY + fromZ * toZ + fromW * toW;

    if (cosine < 0) {
        cosine = -cosine;
        toX = -toX;
        toY = -toY;
        toZ = -toZ;
        toW = -toW;
    }

    let fromScale: number;
    let toScale: number;
    if (cosine > 0.9995) {
        fromScale = 1 - alpha;
        toScale = alpha;
    } else {
        const angle = Math.acos(Math.min(1, cosine));
        const inverseSine = 1 / Math.sin(angle);
        fromScale = Math.sin((1 - alpha) * angle) * inverseSine;
        toScale = Math.sin(alpha * angle) * inverseSine;
    }

    const x = fromX * fromScale + toX * toScale;
    const y = fromY * fromScale + toY * toScale;
    const z = fromZ * fromScale + toZ * toScale;
    const w = fromW * fromScale + toW * toScale;
    const inverseLength = 1 / Math.sqrt(x * x + y * y + z * z + w * w);
    output[Float4.X][outputRow] = x * inverseLength;
    output[Float4.Y][outputRow] = y * inverseLength;
    output[Float4.Z][outputRow] = z * inverseLength;
    output[Float4.W][outputRow] = w * inverseLength;
}

export function rotateFloat3ByQuaternion(
    rotation: ReadonlyFloat4Columns,
    rotationRow: number,
    vector: ReadonlyFloat3Columns,
    vectorRow: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const qx = rotation[Float4.X][rotationRow];
    const qy = rotation[Float4.Y][rotationRow];
    const qz = rotation[Float4.Z][rotationRow];
    const qw = rotation[Float4.W][rotationRow];
    const vx = vector[Float3.X][vectorRow];
    const vy = vector[Float3.Y][vectorRow];
    const vz = vector[Float3.Z][vectorRow];
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    output[Float3.X][outputRow] = vx + qw * tx + qy * tz - qz * ty;
    output[Float3.Y][outputRow] = vy + qw * ty + qz * tx - qx * tz;
    output[Float3.Z][outputRow] = vz + qw * tz + qx * ty - qy * tx;
}
