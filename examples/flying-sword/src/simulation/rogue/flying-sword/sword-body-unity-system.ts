import {
    INVALID_ENTITY,
    Update,
    World,
    defSystem,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordMember,
} from "@zero-ecs/flying-sword";
import { TimeState } from "@zero-ecs/game/time";
import { Float3 } from "@zero-ecs/math/3d";
import {
    DamageKind,
    FlyingSwordContactCooldown,
    FlyingSwordContactCooldownType,
    SwordBodyUnity,
} from "../components";
import { RogueContentService } from "../content-service";
import {
    RogueFlyingSwordCombatQuery,
    RoguePlayerQuery,
} from "../queries";
import {
    EnemySpatialIndexState,
    GRID_CELL_SIZE,
    GRID_HEIGHT,
    GRID_WIDTH,
} from "../state";
import {
    FUSION_BODY_HEIGHT,
    FUSION_CONTACT_COOLDOWN_TICKS,
    FUSION_HIT_RADIUS,
} from "./combat-constants";
import {
    clampGridCell,
    squaredDistanceToSegment3,
} from "./combat-spatial-index";

type Players = QueryOf<typeof RoguePlayerQuery>;
type CombatSwords = QueryOf<typeof RogueFlyingSwordCombatQuery>;

export const collideSwordBodyUnitySystem = defSystem(
    Update.fixed,
    collideSwordBodyUnity,
    [
        World,
        TimeState,
        EnemySpatialIndexState,
        RogueContentService,
        RoguePlayerQuery,
        RogueFlyingSwordCombatQuery,
    ],
);

function collideSwordBodyUnity(
    world: World,
    time: Readonly<TimeState>,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    players: Players,
    swords: CombatSwords,
): void {
    const tick = time.tick;
    const iter = players.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            positions,
            previousPositions,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            actions,
        ] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const active = actions[SwordBodyUnity.Active];
        const damages = actions[SwordBodyUnity.Damage];
        const groups = actions[SwordBodyUnity.Group];
        for (let row = 0; row < count; row++) {
            if (active[row] === 0) continue;
            collideFusionSegment(
                world,
                tick,
                content,
                index,
                entities[row],
                damages[row],
                FUSION_HIT_RADIUS,
                previousXs[row],
                previousYs[row] + FUSION_BODY_HEIGHT,
                previousZs[row],
                xs[row],
                ys[row] + FUSION_BODY_HEIGHT,
                zs[row],
            );
            collideFusionSwords(
                world,
                tick,
                content,
                index,
                entities[row],
                groups[row] as Entity,
                damages[row],
                swords,
            );
        }
    }
}

function collideFusionSwords(
    world: World,
    tick: number,
    content: RogueContentService,
    index: Readonly<EnemySpatialIndexState>,
    source: Entity,
    group: Entity,
    damage: number,
    swords: CombatSwords,
): void {
    if (group === INVALID_ENTITY) return;
    const iter = swords.iter();
    while (iter.next()) {
        const [
            count,
            ,
            members,
            previousPositions,
            positions,
        ] = iter.current;
        const groups = members[FlyingSwordMember.Group];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        for (let row = 0; row < count; row++) {
            if (groups[row] !== group) continue;
            collideFusionSegment(
                world,
                tick,
                content,
                index,
                source,
                damage,
                FUSION_SWORD_HIT_RADIUS,
                previousXs[row],
                previousYs[row],
                previousZs[row],
                xs[row],
                ys[row],
                zs[row],
            );
        }
    }
}

function collideFusionSegment(
    world: World,
    tick: number,
    content: RogueContentService,
    index: Readonly<EnemySpatialIndexState>,
    source: Entity,
    damage: number,
    hitRadius: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): void {
    const padding = hitRadius + 1.2;
    const minimumCellX = clampGridCell(
        Math.floor(
            (Math.min(startX, endX) - padding - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const maximumCellX = clampGridCell(
        Math.floor(
            (Math.max(startX, endX) + padding - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const minimumCellZ = clampGridCell(
        Math.floor(
            (Math.min(startZ, endZ) - padding - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    const maximumCellZ = clampGridCell(
        Math.floor(
            (Math.max(startZ, endZ) + padding - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
                const enemy = index.entities[candidate] as Entity;
                const radius =
                    index.radii[candidate] + hitRadius;
                if (
                    squaredDistanceToSegment3(
                        index.xs[candidate],
                        index.ys[candidate],
                        index.zs[candidate],
                        startX,
                        startY,
                        startZ,
                        endX,
                        endY,
                        endZ,
                    ) <= radius * radius
                ) {
                    const nextTick = world.get(
                        enemy,
                        FlyingSwordContactCooldownType,
                        FlyingSwordContactCooldown.FusionNextTick,
                    );
                    if (nextTick !== null && tick >= nextTick) {
                        world.set(
                            enemy,
                            FlyingSwordContactCooldownType,
                            FlyingSwordContactCooldown.FusionNextTick,
                            tick + FUSION_CONTACT_COOLDOWN_TICKS,
                        );
                        content.requestDamage(
                            source,
                            enemy,
                            damage,
                            DamageKind.SwordBodyUnity,
                        );
                    }
                }
                candidate = index.next[candidate];
            }
        }
    }
}

const FUSION_SWORD_HIT_RADIUS = 0.34;
