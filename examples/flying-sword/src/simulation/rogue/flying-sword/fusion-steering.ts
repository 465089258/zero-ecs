/**
 * 以最大转角把二维单位方向转向目标点。
 *
 * 直接修改 ECS 列，不创建临时向量。返回值表示方向是否发生变化。
 */
export function steerDirection2Towards(
    directionXs: Float32Array,
    directionZs: Float32Array,
    row: number,
    targetX: number,
    targetZ: number,
    maximumRadians: number,
): boolean {
    const targetLength = Math.sqrt(
        targetX * targetX + targetZ * targetZ,
    );
    if (targetLength <= DIRECTION_EPSILON) return false;
    const inverseTargetLength = 1 / targetLength;
    const desiredX = targetX * inverseTargetLength;
    const desiredZ = targetZ * inverseTargetLength;

    const currentX = directionXs[row];
    const currentZ = directionZs[row];
    const currentLength = Math.sqrt(
        currentX * currentX + currentZ * currentZ,
    );
    if (currentLength <= DIRECTION_EPSILON) {
        directionXs[row] = desiredX;
        directionZs[row] = desiredZ;
        return true;
    }
    const inverseCurrentLength = 1 / currentLength;
    const normalizedX = currentX * inverseCurrentLength;
    const normalizedZ = currentZ * inverseCurrentLength;
    const cross = normalizedX * desiredZ - normalizedZ * desiredX;
    const dot = Math.max(
        -1,
        Math.min(
            1,
            normalizedX * desiredX + normalizedZ * desiredZ,
        ),
    );
    const angle = Math.atan2(cross, dot);
    if (Math.abs(angle) <= DIRECTION_EPSILON) return false;

    const maximumTurn = Math.max(0, maximumRadians);
    const turn = Math.max(
        -maximumTurn,
        Math.min(maximumTurn, angle),
    );
    if (Math.abs(turn - angle) <= DIRECTION_EPSILON) {
        directionXs[row] = desiredX;
        directionZs[row] = desiredZ;
        return true;
    }
    const cosine = Math.cos(turn);
    const sine = Math.sin(turn);
    directionXs[row] =
        normalizedX * cosine - normalizedZ * sine;
    directionZs[row] =
        normalizedX * sine + normalizedZ * cosine;
    return true;
}

const DIRECTION_EPSILON = 1e-6;
