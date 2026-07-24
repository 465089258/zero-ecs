import {
    Float2,
    Float3x3,
    type Float2Columns,
    type Float3x3Columns,
    type ReadonlyFloat2Columns,
    type ReadonlyFloat3x3Columns,
} from "./components";

export function identityMatrix3(
    output: Float3x3Columns,
    row: number,
): void {
    output[Float3x3.M00][row] = 1;
    output[Float3x3.M01][row] = 0;
    output[Float3x3.M02][row] = 0;
    output[Float3x3.M10][row] = 0;
    output[Float3x3.M11][row] = 1;
    output[Float3x3.M12][row] = 0;
    output[Float3x3.M20][row] = 0;
    output[Float3x3.M21][row] = 0;
    output[Float3x3.M22][row] = 1;
}

/** 按列向量约定写入二维 Translation × Rotation × Scale 矩阵。 */
export function composeMatrix3(
    position: ReadonlyFloat2Columns,
    positionRow: number,
    radians: number,
    scale: ReadonlyFloat2Columns,
    scaleRow: number,
    output: Float3x3Columns,
    outputRow: number,
): void {
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const scaleX = scale[Float2.X][scaleRow];
    const scaleY = scale[Float2.Y][scaleRow];
    output[Float3x3.M00][outputRow] = cosine * scaleX;
    output[Float3x3.M01][outputRow] = -sine * scaleY;
    output[Float3x3.M02][outputRow] = position[Float2.X][positionRow];
    output[Float3x3.M10][outputRow] = sine * scaleX;
    output[Float3x3.M11][outputRow] = cosine * scaleY;
    output[Float3x3.M12][outputRow] = position[Float2.Y][positionRow];
    output[Float3x3.M20][outputRow] = 0;
    output[Float3x3.M21][outputRow] = 0;
    output[Float3x3.M22][outputRow] = 1;
}

/** output 可以与任一输入使用相同列和行。 */
export function multiplyMatrix3(
    left: ReadonlyFloat3x3Columns,
    leftRow: number,
    right: ReadonlyFloat3x3Columns,
    rightRow: number,
    output: Float3x3Columns,
    outputRow: number,
): void {
    const a00 = left[Float3x3.M00][leftRow];
    const a01 = left[Float3x3.M01][leftRow];
    const a02 = left[Float3x3.M02][leftRow];
    const a10 = left[Float3x3.M10][leftRow];
    const a11 = left[Float3x3.M11][leftRow];
    const a12 = left[Float3x3.M12][leftRow];
    const a20 = left[Float3x3.M20][leftRow];
    const a21 = left[Float3x3.M21][leftRow];
    const a22 = left[Float3x3.M22][leftRow];
    const b00 = right[Float3x3.M00][rightRow];
    const b01 = right[Float3x3.M01][rightRow];
    const b02 = right[Float3x3.M02][rightRow];
    const b10 = right[Float3x3.M10][rightRow];
    const b11 = right[Float3x3.M11][rightRow];
    const b12 = right[Float3x3.M12][rightRow];
    const b20 = right[Float3x3.M20][rightRow];
    const b21 = right[Float3x3.M21][rightRow];
    const b22 = right[Float3x3.M22][rightRow];
    output[Float3x3.M00][outputRow] = a00 * b00 + a01 * b10 + a02 * b20;
    output[Float3x3.M01][outputRow] = a00 * b01 + a01 * b11 + a02 * b21;
    output[Float3x3.M02][outputRow] = a00 * b02 + a01 * b12 + a02 * b22;
    output[Float3x3.M10][outputRow] = a10 * b00 + a11 * b10 + a12 * b20;
    output[Float3x3.M11][outputRow] = a10 * b01 + a11 * b11 + a12 * b21;
    output[Float3x3.M12][outputRow] = a10 * b02 + a11 * b12 + a12 * b22;
    output[Float3x3.M20][outputRow] = a20 * b00 + a21 * b10 + a22 * b20;
    output[Float3x3.M21][outputRow] = a20 * b01 + a21 * b11 + a22 * b21;
    output[Float3x3.M22][outputRow] = a20 * b02 + a21 * b12 + a22 * b22;
}

export function transformPoint2(
    matrix: ReadonlyFloat3x3Columns,
    matrixRow: number,
    point: ReadonlyFloat2Columns,
    pointRow: number,
    output: Float2Columns,
    outputRow: number,
): void {
    const x = point[Float2.X][pointRow];
    const y = point[Float2.Y][pointRow];
    const transformedX = matrix[Float3x3.M00][matrixRow] * x +
        matrix[Float3x3.M01][matrixRow] * y +
        matrix[Float3x3.M02][matrixRow];
    const transformedY = matrix[Float3x3.M10][matrixRow] * x +
        matrix[Float3x3.M11][matrixRow] * y +
        matrix[Float3x3.M12][matrixRow];
    output[Float2.X][outputRow] = transformedX;
    output[Float2.Y][outputRow] = transformedY;
}

export function transformDirection2(
    matrix: ReadonlyFloat3x3Columns,
    matrixRow: number,
    direction: ReadonlyFloat2Columns,
    directionRow: number,
    output: Float2Columns,
    outputRow: number,
): void {
    const x = direction[Float2.X][directionRow];
    const y = direction[Float2.Y][directionRow];
    const transformedX = matrix[Float3x3.M00][matrixRow] * x +
        matrix[Float3x3.M01][matrixRow] * y;
    const transformedY = matrix[Float3x3.M10][matrixRow] * x +
        matrix[Float3x3.M11][matrixRow] * y;
    output[Float2.X][outputRow] = transformedX;
    output[Float2.Y][outputRow] = transformedY;
}
