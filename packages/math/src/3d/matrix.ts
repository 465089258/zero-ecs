import {
    Float3,
    Float4,
    Float4x4,
    type Float3Columns,
    type Float4x4Columns,
    type ReadonlyFloat3Columns,
    type ReadonlyFloat4Columns,
    type ReadonlyFloat4x4Columns,
} from "./components";

export function identityMatrix4(
    output: Float4x4Columns,
    row: number,
): void {
    output[Float4x4.M00][row] = 1;
    output[Float4x4.M01][row] = 0;
    output[Float4x4.M02][row] = 0;
    output[Float4x4.M03][row] = 0;
    output[Float4x4.M10][row] = 0;
    output[Float4x4.M11][row] = 1;
    output[Float4x4.M12][row] = 0;
    output[Float4x4.M13][row] = 0;
    output[Float4x4.M20][row] = 0;
    output[Float4x4.M21][row] = 0;
    output[Float4x4.M22][row] = 1;
    output[Float4x4.M23][row] = 0;
    output[Float4x4.M30][row] = 0;
    output[Float4x4.M31][row] = 0;
    output[Float4x4.M32][row] = 0;
    output[Float4x4.M33][row] = 1;
}

/** 按列向量约定写入 Translation × Rotation × Scale 矩阵。 */
export function composeMatrix4(
    position: ReadonlyFloat3Columns,
    positionRow: number,
    rotation: ReadonlyFloat4Columns,
    rotationRow: number,
    scale: ReadonlyFloat3Columns,
    scaleRow: number,
    output: Float4x4Columns,
    outputRow: number,
): void {
    const x = rotation[Float4.X][rotationRow];
    const y = rotation[Float4.Y][rotationRow];
    const z = rotation[Float4.Z][rotationRow];
    const w = rotation[Float4.W][rotationRow];
    const x2 = x + x;
    const y2 = y + y;
    const z2 = z + z;
    const xx = x * x2;
    const xy = x * y2;
    const xz = x * z2;
    const yy = y * y2;
    const yz = y * z2;
    const zz = z * z2;
    const wx = w * x2;
    const wy = w * y2;
    const wz = w * z2;
    const scaleX = scale[Float3.X][scaleRow];
    const scaleY = scale[Float3.Y][scaleRow];
    const scaleZ = scale[Float3.Z][scaleRow];

    output[Float4x4.M00][outputRow] = (1 - yy - zz) * scaleX;
    output[Float4x4.M01][outputRow] = (xy - wz) * scaleY;
    output[Float4x4.M02][outputRow] = (xz + wy) * scaleZ;
    output[Float4x4.M03][outputRow] = position[Float3.X][positionRow];
    output[Float4x4.M10][outputRow] = (xy + wz) * scaleX;
    output[Float4x4.M11][outputRow] = (1 - xx - zz) * scaleY;
    output[Float4x4.M12][outputRow] = (yz - wx) * scaleZ;
    output[Float4x4.M13][outputRow] = position[Float3.Y][positionRow];
    output[Float4x4.M20][outputRow] = (xz - wy) * scaleX;
    output[Float4x4.M21][outputRow] = (yz + wx) * scaleY;
    output[Float4x4.M22][outputRow] = (1 - xx - yy) * scaleZ;
    output[Float4x4.M23][outputRow] = position[Float3.Z][positionRow];
    output[Float4x4.M30][outputRow] = 0;
    output[Float4x4.M31][outputRow] = 0;
    output[Float4x4.M32][outputRow] = 0;
    output[Float4x4.M33][outputRow] = 1;
}

/** output 可以与任一输入使用相同列和行。 */
export function multiplyMatrix4(
    left: ReadonlyFloat4x4Columns,
    leftRow: number,
    right: ReadonlyFloat4x4Columns,
    rightRow: number,
    output: Float4x4Columns,
    outputRow: number,
): void {
    const a00 = left[Float4x4.M00][leftRow];
    const a01 = left[Float4x4.M01][leftRow];
    const a02 = left[Float4x4.M02][leftRow];
    const a03 = left[Float4x4.M03][leftRow];
    const a10 = left[Float4x4.M10][leftRow];
    const a11 = left[Float4x4.M11][leftRow];
    const a12 = left[Float4x4.M12][leftRow];
    const a13 = left[Float4x4.M13][leftRow];
    const a20 = left[Float4x4.M20][leftRow];
    const a21 = left[Float4x4.M21][leftRow];
    const a22 = left[Float4x4.M22][leftRow];
    const a23 = left[Float4x4.M23][leftRow];
    const a30 = left[Float4x4.M30][leftRow];
    const a31 = left[Float4x4.M31][leftRow];
    const a32 = left[Float4x4.M32][leftRow];
    const a33 = left[Float4x4.M33][leftRow];
    const b00 = right[Float4x4.M00][rightRow];
    const b01 = right[Float4x4.M01][rightRow];
    const b02 = right[Float4x4.M02][rightRow];
    const b03 = right[Float4x4.M03][rightRow];
    const b10 = right[Float4x4.M10][rightRow];
    const b11 = right[Float4x4.M11][rightRow];
    const b12 = right[Float4x4.M12][rightRow];
    const b13 = right[Float4x4.M13][rightRow];
    const b20 = right[Float4x4.M20][rightRow];
    const b21 = right[Float4x4.M21][rightRow];
    const b22 = right[Float4x4.M22][rightRow];
    const b23 = right[Float4x4.M23][rightRow];
    const b30 = right[Float4x4.M30][rightRow];
    const b31 = right[Float4x4.M31][rightRow];
    const b32 = right[Float4x4.M32][rightRow];
    const b33 = right[Float4x4.M33][rightRow];

    output[Float4x4.M00][outputRow] = a00 * b00 + a01 * b10 +
        a02 * b20 + a03 * b30;
    output[Float4x4.M01][outputRow] = a00 * b01 + a01 * b11 +
        a02 * b21 + a03 * b31;
    output[Float4x4.M02][outputRow] = a00 * b02 + a01 * b12 +
        a02 * b22 + a03 * b32;
    output[Float4x4.M03][outputRow] = a00 * b03 + a01 * b13 +
        a02 * b23 + a03 * b33;
    output[Float4x4.M10][outputRow] = a10 * b00 + a11 * b10 +
        a12 * b20 + a13 * b30;
    output[Float4x4.M11][outputRow] = a10 * b01 + a11 * b11 +
        a12 * b21 + a13 * b31;
    output[Float4x4.M12][outputRow] = a10 * b02 + a11 * b12 +
        a12 * b22 + a13 * b32;
    output[Float4x4.M13][outputRow] = a10 * b03 + a11 * b13 +
        a12 * b23 + a13 * b33;
    output[Float4x4.M20][outputRow] = a20 * b00 + a21 * b10 +
        a22 * b20 + a23 * b30;
    output[Float4x4.M21][outputRow] = a20 * b01 + a21 * b11 +
        a22 * b21 + a23 * b31;
    output[Float4x4.M22][outputRow] = a20 * b02 + a21 * b12 +
        a22 * b22 + a23 * b32;
    output[Float4x4.M23][outputRow] = a20 * b03 + a21 * b13 +
        a22 * b23 + a23 * b33;
    output[Float4x4.M30][outputRow] = a30 * b00 + a31 * b10 +
        a32 * b20 + a33 * b30;
    output[Float4x4.M31][outputRow] = a30 * b01 + a31 * b11 +
        a32 * b21 + a33 * b31;
    output[Float4x4.M32][outputRow] = a30 * b02 + a31 * b12 +
        a32 * b22 + a33 * b32;
    output[Float4x4.M33][outputRow] = a30 * b03 + a31 * b13 +
        a32 * b23 + a33 * b33;
}

export function transformPoint3(
    matrix: ReadonlyFloat4x4Columns,
    matrixRow: number,
    point: ReadonlyFloat3Columns,
    pointRow: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const x = point[Float3.X][pointRow];
    const y = point[Float3.Y][pointRow];
    const z = point[Float3.Z][pointRow];
    const transformedX = matrix[Float4x4.M00][matrixRow] * x +
        matrix[Float4x4.M01][matrixRow] * y +
        matrix[Float4x4.M02][matrixRow] * z +
        matrix[Float4x4.M03][matrixRow];
    const transformedY = matrix[Float4x4.M10][matrixRow] * x +
        matrix[Float4x4.M11][matrixRow] * y +
        matrix[Float4x4.M12][matrixRow] * z +
        matrix[Float4x4.M13][matrixRow];
    const transformedZ = matrix[Float4x4.M20][matrixRow] * x +
        matrix[Float4x4.M21][matrixRow] * y +
        matrix[Float4x4.M22][matrixRow] * z +
        matrix[Float4x4.M23][matrixRow];
    const transformedW = matrix[Float4x4.M30][matrixRow] * x +
        matrix[Float4x4.M31][matrixRow] * y +
        matrix[Float4x4.M32][matrixRow] * z +
        matrix[Float4x4.M33][matrixRow];
    const inverseW = transformedW !== 0 && transformedW !== 1
        ? 1 / transformedW
        : 1;
    output[Float3.X][outputRow] = transformedX * inverseW;
    output[Float3.Y][outputRow] = transformedY * inverseW;
    output[Float3.Z][outputRow] = transformedZ * inverseW;
}

export function transformDirection3(
    matrix: ReadonlyFloat4x4Columns,
    matrixRow: number,
    direction: ReadonlyFloat3Columns,
    directionRow: number,
    output: Float3Columns,
    outputRow: number,
): void {
    const x = direction[Float3.X][directionRow];
    const y = direction[Float3.Y][directionRow];
    const z = direction[Float3.Z][directionRow];
    const transformedX = matrix[Float4x4.M00][matrixRow] * x +
        matrix[Float4x4.M01][matrixRow] * y +
        matrix[Float4x4.M02][matrixRow] * z;
    const transformedY = matrix[Float4x4.M10][matrixRow] * x +
        matrix[Float4x4.M11][matrixRow] * y +
        matrix[Float4x4.M12][matrixRow] * z;
    const transformedZ = matrix[Float4x4.M20][matrixRow] * x +
        matrix[Float4x4.M21][matrixRow] * y +
        matrix[Float4x4.M22][matrixRow] * z;
    output[Float3.X][outputRow] = transformedX;
    output[Float3.Y][outputRow] = transformedY;
    output[Float3.Z][outputRow] = transformedZ;
}
