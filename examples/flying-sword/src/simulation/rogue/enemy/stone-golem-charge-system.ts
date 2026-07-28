import {
    Update,
    defSystem,
    type QueryOf,
} from "@zero-ecs/game";
import { Float3 } from "../../../infrastructure/math";
import {
    MotionSystemSet,
    MoveTowards3,
} from "../../../infrastructure/motion";
import {
    EnemyLocomotion,
    RogueRunClock,
    RogueRunPhase,
    RogueRunStatus,
    StoneGolemCharge,
    StoneGolemChargePhase,
} from "../components";
import {
    RogueCultivatorPositionQuery,
    RogueRunPhaseQuery,
    RogueStoneGolemChargeQuery,
} from "../queries";
import {
    RogueSystemSet,
    updateEnemyIntentSystem,
} from "../systems";

type Runs = QueryOf<typeof RogueRunPhaseQuery>;
type Players = QueryOf<typeof RogueCultivatorPositionQuery>;
type StoneGolems = QueryOf<typeof RogueStoneGolemChargeQuery>;

export const STONE_GOLEM_CHARGE_TRIGGER_RADIUS = 8;
export const STONE_GOLEM_CHARGE_WINDUP_TICKS = 42;
export const STONE_GOLEM_CHARGE_DURATION_TICKS = 38;
export const STONE_GOLEM_CHARGE_RECOVERY_TICKS = 24;
export const STONE_GOLEM_CHARGE_COOLDOWN_TICKS = 180;
export const STONE_GOLEM_CHARGE_SPEED = 8;
export const STONE_GOLEM_CHARGE_ACCELERATION = 52;
export const STONE_GOLEM_CHARGE_LOOKAHEAD = 16;

export const updateStoneGolemChargeSystem = defSystem(
    Update.fixed,
    updateStoneGolemCharge,
    [
        RogueRunPhaseQuery,
        RogueCultivatorPositionQuery,
        RogueStoneGolemChargeQuery,
    ],
);

export const StoneGolemChargeSystemOptions = Object.freeze({
    inSet: RogueSystemSet.Intent,
    after: updateEnemyIntentSystem,
    before: MotionSystemSet.Integrate3,
});

function updateStoneGolemCharge(
    runs: Runs,
    players: Players,
    stoneGolems: StoneGolems,
): void {
    let playing = false;
    let tick = 0;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [count, , clocks, statuses] = runIter.current;
        if (count === 0) continue;
        tick = clocks[RogueRunClock.Tick][0];
        playing =
            statuses[RogueRunStatus.Phase][0] === RogueRunPhase.Playing;
        break;
    }
    if (!playing) return;

    let hasPlayer = false;
    let playerX = 0;
    let playerY = 0;
    let playerZ = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , positions] = playerIter.current;
        if (count === 0) continue;
        hasPlayer = true;
        playerX = positions[Float3.X][0];
        playerY = positions[Float3.Y][0];
        playerZ = positions[Float3.Z][0];
        break;
    }
    if (!hasPlayer) return;

    const iter = stoneGolems.iter();
    while (iter.next()) {
        const [
            count,
            ,
            positions,
            velocities,
            motions,
            locomotions,
            charges,
        ] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const velocityXs = velocities[Float3.X];
        const velocityYs = velocities[Float3.Y];
        const velocityZs = velocities[Float3.Z];
        const targetXs = motions[MoveTowards3.TargetX];
        const targetYs = motions[MoveTowards3.TargetY];
        const targetZs = motions[MoveTowards3.TargetZ];
        const baseSpeeds =
            locomotions[EnemyLocomotion.BaseSpeed];
        const baseAccelerations =
            locomotions[EnemyLocomotion.BaseAcceleration];
        const desiredSpeeds =
            locomotions[EnemyLocomotion.DesiredSpeed];
        const desiredAccelerations =
            locomotions[EnemyLocomotion.DesiredAcceleration];
        const phases = charges[StoneGolemCharge.Phase];
        const phaseStartTicks =
            charges[StoneGolemCharge.PhaseStartTick];
        const nextChargeTicks =
            charges[StoneGolemCharge.NextChargeTick];
        const directionXs =
            charges[StoneGolemCharge.DirectionX];
        const directionZs =
            charges[StoneGolemCharge.DirectionZ];

        for (let row = 0; row < count; row++) {
            const phase = phases[row];
            if (phase === StoneGolemChargePhase.Pursuit) {
                if (
                    !shouldStartStoneGolemCharge(
                        xs[row],
                        zs[row],
                        playerX,
                        playerZ,
                        tick,
                        nextChargeTicks[row],
                    )
                ) {
                    continue;
                }
                const dx = playerX - xs[row];
                const dz = playerZ - zs[row];
                const distance = Math.sqrt(dx * dx + dz * dz);
                if (distance > 1e-5) {
                    const inverseDistance = 1 / distance;
                    directionXs[row] = dx * inverseDistance;
                    directionZs[row] = dz * inverseDistance;
                }
                phases[row] = StoneGolemChargePhase.Windup;
                phaseStartTicks[row] = tick;
                holdStoneGolem(
                    row,
                    xs,
                    ys,
                    zs,
                    velocityXs,
                    velocityYs,
                    velocityZs,
                    targetXs,
                    targetYs,
                    targetZs,
                    desiredSpeeds,
                    desiredAccelerations,
                    baseAccelerations,
                );
                continue;
            }

            if (phase === StoneGolemChargePhase.Windup) {
                holdStoneGolem(
                    row,
                    xs,
                    ys,
                    zs,
                    velocityXs,
                    velocityYs,
                    velocityZs,
                    targetXs,
                    targetYs,
                    targetZs,
                    desiredSpeeds,
                    desiredAccelerations,
                    baseAccelerations,
                );
                if (
                    tick - phaseStartTicks[row] <
                    STONE_GOLEM_CHARGE_WINDUP_TICKS
                ) {
                    continue;
                }
                phases[row] = StoneGolemChargePhase.Charging;
                phaseStartTicks[row] = tick;
                driveStoneGolemCharge(
                    row,
                    xs,
                    ys,
                    zs,
                    velocityXs,
                    velocityYs,
                    velocityZs,
                    targetXs,
                    targetYs,
                    targetZs,
                    desiredSpeeds,
                    desiredAccelerations,
                    directionXs,
                    directionZs,
                );
                continue;
            }

            if (phase === StoneGolemChargePhase.Charging) {
                if (
                    tick - phaseStartTicks[row] <
                    STONE_GOLEM_CHARGE_DURATION_TICKS
                ) {
                    driveStoneGolemCharge(
                        row,
                        xs,
                        ys,
                        zs,
                        velocityXs,
                        velocityYs,
                        velocityZs,
                        targetXs,
                        targetYs,
                        targetZs,
                        desiredSpeeds,
                        desiredAccelerations,
                        directionXs,
                        directionZs,
                    );
                    continue;
                }
                phases[row] = StoneGolemChargePhase.Recovery;
                phaseStartTicks[row] = tick;
                nextChargeTicks[row] =
                    tick + STONE_GOLEM_CHARGE_COOLDOWN_TICKS;
                holdStoneGolem(
                    row,
                    xs,
                    ys,
                    zs,
                    velocityXs,
                    velocityYs,
                    velocityZs,
                    targetXs,
                    targetYs,
                    targetZs,
                    desiredSpeeds,
                    desiredAccelerations,
                    baseAccelerations,
                );
                continue;
            }

            if (
                tick - phaseStartTicks[row] <
                STONE_GOLEM_CHARGE_RECOVERY_TICKS
            ) {
                holdStoneGolem(
                    row,
                    xs,
                    ys,
                    zs,
                    velocityXs,
                    velocityYs,
                    velocityZs,
                    targetXs,
                    targetYs,
                    targetZs,
                    desiredSpeeds,
                    desiredAccelerations,
                    baseAccelerations,
                );
                continue;
            }
            phases[row] = StoneGolemChargePhase.Pursuit;
            phaseStartTicks[row] = tick;
            desiredSpeeds[row] = baseSpeeds[row];
            desiredAccelerations[row] = baseAccelerations[row];
            targetXs[row] = playerX;
            targetYs[row] = playerY;
            targetZs[row] = playerZ;
        }
    }
}

export function shouldStartStoneGolemCharge(
    x: number,
    z: number,
    playerX: number,
    playerZ: number,
    tick: number,
    nextChargeTick: number,
): boolean {
    if (tick < nextChargeTick) return false;
    const dx = playerX - x;
    const dz = playerZ - z;
    return dx * dx + dz * dz <=
        STONE_GOLEM_CHARGE_TRIGGER_RADIUS *
            STONE_GOLEM_CHARGE_TRIGGER_RADIUS;
}

function holdStoneGolem(
    row: number,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    velocityXs: Float32Array,
    velocityYs: Float32Array,
    velocityZs: Float32Array,
    targetXs: Float32Array,
    targetYs: Float32Array,
    targetZs: Float32Array,
    desiredSpeeds: Float32Array,
    desiredAccelerations: Float32Array,
    baseAccelerations: Float32Array,
): void {
    targetXs[row] = xs[row];
    targetYs[row] = ys[row];
    targetZs[row] = zs[row];
    desiredSpeeds[row] = 0;
    desiredAccelerations[row] = baseAccelerations[row];
    velocityXs[row] = 0;
    velocityYs[row] = 0;
    velocityZs[row] = 0;
}

function driveStoneGolemCharge(
    row: number,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    velocityXs: Float32Array,
    velocityYs: Float32Array,
    velocityZs: Float32Array,
    targetXs: Float32Array,
    targetYs: Float32Array,
    targetZs: Float32Array,
    desiredSpeeds: Float32Array,
    desiredAccelerations: Float32Array,
    directionXs: Float32Array,
    directionZs: Float32Array,
): void {
    const directionX = directionXs[row];
    const directionZ = directionZs[row];
    targetXs[row] =
        xs[row] + directionX * STONE_GOLEM_CHARGE_LOOKAHEAD;
    targetYs[row] = ys[row];
    targetZs[row] =
        zs[row] + directionZ * STONE_GOLEM_CHARGE_LOOKAHEAD;
    desiredSpeeds[row] = STONE_GOLEM_CHARGE_SPEED;
    desiredAccelerations[row] = STONE_GOLEM_CHARGE_ACCELERATION;
    if (
        velocityXs[row] * directionX +
        velocityZs[row] * directionZ <= 0
    ) {
        velocityXs[row] = directionX * STONE_GOLEM_CHARGE_SPEED;
        velocityYs[row] = 0;
        velocityZs[row] = directionZ * STONE_GOLEM_CHARGE_SPEED;
    }
}
