import {
    Update,
    Write,
    defSystem,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { Float3 } from "@zero-ecs/math/3d";
import {
    EnemyBody,
    Health,
} from "../components";
import {
    RogueEnemyQuery,
    RoguePlayerQuery,
} from "../queries";
import {
    EnemySpatialIndexState,
    GRID_CELL_SIZE,
    GRID_HEIGHT,
    GRID_WIDTH,
} from "../state";
type Players = QueryOf<typeof RoguePlayerQuery>;
type Enemies = QueryOf<typeof RogueEnemyQuery>;

export const rebuildEnemySpatialIndexSystem = defSystem(
    Update.fixed,
    rebuildEnemySpatialIndex,
    [
        Write(EnemySpatialIndexState),
        RoguePlayerQuery,
        RogueEnemyQuery,
    ],
);

function rebuildEnemySpatialIndex(
    index: Mut<EnemySpatialIndexState>,
    players: Players,
    enemies: Enemies,
): void {
    let playerX = 0;
    let playerZ = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , positions] = playerIter.current;
        if (count === 0) continue;
        playerX = positions[Float3.X][0];
        playerZ = positions[Float3.Z][0];
        break;
    }
    index.reset(playerX, playerZ);
    const iter = enemies.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            positions,
            ,
            ,
            ,
            ,
            ,
            bodies,
            ,
            health,
        ] = iter.current;
        index.ensureCapacity(index.count + count);
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const radii = bodies[EnemyBody.Radius];
        const centerHeights = bodies[EnemyBody.CenterHeight];
        const currentHealth = health[Health.Current];
        for (let row = 0; row < count; row++) {
            if (currentHealth[row] <= 0) continue;
            index.insert(
                entities[row],
                xs[row],
                ys[row] + centerHeights[row],
                zs[row],
                radii[row],
            );
        }
    }
}

export function clampGridCell(value: number, size: number): number {
    return Math.max(0, Math.min(size - 1, value));
}

export function squaredDistanceToSegment3(
    pointX: number,
    pointY: number,
    pointZ: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): number {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentZ = endZ - startZ;
    const lengthSquared =
        segmentX * segmentX +
        segmentY * segmentY +
        segmentZ * segmentZ;
    let t = 0;
    if (lengthSquared > 1e-8) {
        t = (
            (pointX - startX) * segmentX +
            (pointY - startY) * segmentY +
            (pointZ - startZ) * segmentZ
        ) / lengthSquared;
        t = Math.max(0, Math.min(1, t));
    }
    const dx = pointX - (startX + segmentX * t);
    const dy = pointY - (startY + segmentY * t);
    const dz = pointZ - (startZ + segmentZ * t);
    return dx * dx + dy * dy + dz * dz;
}
