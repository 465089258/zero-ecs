import {
    QueryType,
    SystemSet,
    Types,
    Update,
    With,
    defSystem,
    type Component,
    type GameBuilder,
    type Module,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    Direction3Type,
    Float3,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
} from "./math";

/** 示例完成规则归并后的三维目标追踪输入。 */
export enum MoveTowards3 {
    TargetX,
    TargetY,
    TargetZ,
    MaximumSpeed,
    Acceleration,
    ArrivalRadius,
}

export class MoveTowards3Type implements Component<MoveTowards3> {
    readonly [MoveTowards3.TargetX] = Types.F32;
    readonly [MoveTowards3.TargetY] = Types.F32;
    readonly [MoveTowards3.TargetZ] = Types.F32;
    readonly [MoveTowards3.MaximumSpeed] = Types.F32;
    readonly [MoveTowards3.Acceleration] = Types.F32;
    readonly [MoveTowards3.ArrivalRadius] = Types.F32;
}

const MoveTowards3Query = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
    Direction3Type,
    MoveTowards3Type,
));

type Moving3 = QueryOf<typeof MoveTowards3Query>;

export const MotionSystemSet = Object.freeze({
    Integrate3: new SystemSet(Update.fixed, "demo-motion:integrate-3d"),
});

export const moveTowards3System = defSystem(
    Update.fixed,
    moveTowards3,
    [TimeState, MoveTowards3Query],
);

const MoveTowards3SystemOptions = Object.freeze({
    inSet: MotionSystemSet.Integrate3,
});

/** 示例自有运动模块；不作为框架公共能力发布。 */
export class DemoMotionModule implements Module {
    build(builder: GameBuilder): void {
        builder.addSystem(
            moveTowards3System,
            MoveTowards3SystemOptions,
        );
    }
}

function moveTowards3(
    time: Readonly<TimeState>,
    moving: Moving3,
): void {
    const iter = moving.iter();
    while (iter.next()) {
        const [
            count,
            ,
            positions,
            previousPositions,
            velocities,
            directions,
            inputs,
        ] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const velocityXs = velocities[Float3.X];
        const velocityYs = velocities[Float3.Y];
        const velocityZs = velocities[Float3.Z];
        const directionXs = directions[Float3.X];
        const directionYs = directions[Float3.Y];
        const directionZs = directions[Float3.Z];
        const targetXs = inputs[MoveTowards3.TargetX];
        const targetYs = inputs[MoveTowards3.TargetY];
        const targetZs = inputs[MoveTowards3.TargetZ];
        const maximumSpeeds = inputs[MoveTowards3.MaximumSpeed];
        const accelerations = inputs[MoveTowards3.Acceleration];
        const arrivalRadii = inputs[MoveTowards3.ArrivalRadius];

        for (let row = 0; row < count; row++) {
            const x = xs[row];
            const y = ys[row];
            const z = zs[row];
            previousXs[row] = x;
            previousYs[row] = y;
            previousZs[row] = z;

            const dx = targetXs[row] - x;
            const dy = targetYs[row] - y;
            const dz = targetZs[row] - z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const desiredSpeed = distance <= arrivalRadii[row]
                ? 0
                : Math.min(maximumSpeeds[row], distance * 6);
            const inverseDistance = distance > 1e-6 ? 1 / distance : 0;
            const desiredVelocityX =
                dx * inverseDistance * desiredSpeed;
            const desiredVelocityY =
                dy * inverseDistance * desiredSpeed;
            const desiredVelocityZ =
                dz * inverseDistance * desiredSpeed;

            let changeX = desiredVelocityX - velocityXs[row];
            let changeY = desiredVelocityY - velocityYs[row];
            let changeZ = desiredVelocityZ - velocityZs[row];
            const changeLength = Math.sqrt(
                changeX * changeX +
                changeY * changeY +
                changeZ * changeZ,
            );
            const maximumChange = accelerations[row] * time.delta;
            if (changeLength > maximumChange && changeLength > 1e-6) {
                const scale = maximumChange / changeLength;
                changeX *= scale;
                changeY *= scale;
                changeZ *= scale;
            }

            const velocityX = velocityXs[row] + changeX;
            const velocityY = velocityYs[row] + changeY;
            const velocityZ = velocityZs[row] + changeZ;
            velocityXs[row] = velocityX;
            velocityYs[row] = velocityY;
            velocityZs[row] = velocityZ;
            xs[row] = x + velocityX * time.delta;
            ys[row] = y + velocityY * time.delta;
            zs[row] = z + velocityZ * time.delta;

            const velocityLength = Math.sqrt(
                velocityX * velocityX +
                velocityY * velocityY +
                velocityZ * velocityZ,
            );
            if (velocityLength > 1e-4) {
                const inverseVelocity = 1 / velocityLength;
                directionXs[row] = velocityX * inverseVelocity;
                directionYs[row] = velocityY * inverseVelocity;
                directionZs[row] = velocityZ * inverseVelocity;
            }
        }
    }
}
