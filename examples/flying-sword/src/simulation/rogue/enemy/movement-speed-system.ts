import {
    Update,
    defSystem,
    type QueryOf,
} from "@zero-ecs/game";
import {
    MotionSystemSet,
    MoveTowards3,
} from "../../../infrastructure/motion";
import { EnemyLocomotion } from "../components";
import { RogueEnemyMovementQuery } from "../queries";
import { RogueSystemSet } from "../systems";

type MovingEnemies = QueryOf<typeof RogueEnemyMovementQuery>;

export const resolveEnemyMovementSpeedSystem = defSystem(
    Update.fixed,
    resolveEnemyMovementSpeed,
    [RogueEnemyMovementQuery],
);

export const EnemyMovementSpeedSystemOptions = Object.freeze({
    inSet: RogueSystemSet.EnemyResolve,
    after: RogueSystemSet.Intent,
    before: MotionSystemSet.Integrate3,
});

function resolveEnemyMovementSpeed(
    enemies: MovingEnemies,
): void {
    const iter = enemies.iter();
    while (iter.next()) {
        const [count, , locomotions, motions] = iter.current;
        const desiredSpeeds =
            locomotions[EnemyLocomotion.DesiredSpeed];
        const desiredAccelerations =
            locomotions[EnemyLocomotion.DesiredAcceleration];
        const maximumSpeeds = motions[MoveTowards3.MaximumSpeed];
        const accelerations = motions[MoveTowards3.Acceleration];
        for (let row = 0; row < count; row++) {
            maximumSpeeds[row] = desiredSpeeds[row];
            accelerations[row] = desiredAccelerations[row];
        }
    }
}
