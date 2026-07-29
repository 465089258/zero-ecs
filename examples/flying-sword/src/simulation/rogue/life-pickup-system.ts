import {
    Commands,
    INVALID_ENTITY,
    Update,
    defSystem,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import { Float3 } from "../../infrastructure/math";
import {
    HealingKind,
    Health,
    LifePickup,
    PlayerPickup,
} from "./components";
import {
    RogueLifePickupQuery,
    RoguePlayerQuery,
} from "./queries";
import {
    RogueContentService,
} from "./content-service";
import { RogueSystemSet } from "./systems";

type Players = QueryOf<typeof RoguePlayerQuery>;
type LifePickups = QueryOf<typeof RogueLifePickupQuery>;

export const collectLifePickupsSystem = defSystem(
    Update.fixed,
    collectLifePickups,
    [
        TimeState,
        Commands,
        RogueContentService,
        RoguePlayerQuery,
        RogueLifePickupQuery,
    ],
);

export const LifePickupSystemOptions = Object.freeze({
    inSet: RogueSystemSet.Progression,
    after: RogueSystemSet.Death,
    before: RogueSystemSet.OpenUpgrade,
});

function collectLifePickups(
    time: Readonly<TimeState>,
    commands: Commands,
    content: RogueContentService,
    players: Players,
    pickups: LifePickups,
): void {
    let player = INVALID_ENTITY as Entity;
    let playerX = 0;
    let playerY = 0;
    let playerZ = 0;
    let maximumLife = 0;
    let attractionRadius = 0;
    let pickupRadius = 0;
    let attractionSpeed = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const data = playerIter.current;
        if (data[0] === 0) continue;
        player = data[1][0];
        playerX = data[2][Float3.X][0];
        playerY = data[2][Float3.Y][0];
        playerZ = data[2][Float3.Z][0];
        maximumLife = data[8][Health.Maximum][0];
        attractionRadius =
            data[11][PlayerPickup.AttractionRadius][0];
        pickupRadius = data[11][PlayerPickup.PickupRadius][0];
        attractionSpeed =
            data[11][PlayerPickup.AttractionSpeed][0];
        break;
    }
    if (player === INVALID_ENTITY) return;
    const attractionSquared = attractionRadius * attractionRadius;
    const pickupSquared = pickupRadius * pickupRadius;
    const iter = pickups.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            positions,
            previous,
            velocities,
            life,
        ] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const previousXs = previous[Float3.X];
        const previousYs = previous[Float3.Y];
        const previousZs = previous[Float3.Z];
        const velocityXs = velocities[Float3.X];
        const velocityYs = velocities[Float3.Y];
        const velocityZs = velocities[Float3.Z];
        const ratios = life[LifePickup.MaximumLifeRatio];
        for (let row = 0; row < count; row++) {
            const dx = playerX - xs[row];
            const dz = playerZ - zs[row];
            const distanceSquared = dx * dx + dz * dz;
            if (distanceSquared > LIFE_PICKUP_DESPAWN_DISTANCE_SQUARED) {
                commands.entity(entities[row]).despawn().submit();
                continue;
            }
            if (distanceSquared <= pickupSquared) {
                content.requestHealing(
                    entities[row],
                    player,
                    maximumLife * Math.max(0, ratios[row]),
                    HealingKind.Pickup,
                );
                commands.entity(entities[row]).despawn().submit();
                continue;
            }
            previousXs[row] = xs[row];
            previousYs[row] = ys[row];
            previousZs[row] = zs[row];
            if (distanceSquared > attractionSquared) {
                velocityXs[row] = 0;
                velocityYs[row] = 0;
                velocityZs[row] = 0;
                continue;
            }
            const distance = Math.sqrt(distanceSquared);
            if (distance <= 0.0001) continue;
            const step = Math.min(
                distance,
                attractionSpeed * time.delta,
            );
            const inverseDistance = 1 / distance;
            velocityXs[row] = dx * inverseDistance * attractionSpeed;
            velocityYs[row] =
                (playerY + 0.25 - ys[row]) * attractionSpeed;
            velocityZs[row] = dz * inverseDistance * attractionSpeed;
            xs[row] += dx * inverseDistance * step;
            ys[row] += (playerY + 0.25 - ys[row]) *
                Math.min(1, time.delta * attractionSpeed);
            zs[row] += dz * inverseDistance * step;
        }
    }
}

const LIFE_PICKUP_DESPAWN_DISTANCE_SQUARED = 60 * 60;
