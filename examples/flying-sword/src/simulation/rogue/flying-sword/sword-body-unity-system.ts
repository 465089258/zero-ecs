import {
    INVALID_ENTITY,
    Update,
    World,
    Write,
    defSystem,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordMember,
} from "../../../domain/flying-sword";
import { TimeState } from "@zero-ecs/game/time";
import { Float3 } from "../../../infrastructure/math";
import {
    DamageKind,
    FlyingSwordContactCooldown,
    FlyingSwordContactCooldownType,
    SwordBodyUnity,
    SwordBodyUnityPiercingSequence,
} from "../components";
import { RogueContentService } from "../content-service";
import {
    RogueFlyingSwordCombatQuery,
    RogueSwordBodyUnityContactQuery,
} from "../queries";
import {
    CombatScratchState,
    EnemySpatialIndexState,
    FusionPiercingCandidateState,
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
    progressAlongSegment3,
    squaredDistanceToSegment3,
} from "./combat-spatial-index";

type Players = QueryOf<typeof RogueSwordBodyUnityContactQuery>;
type CombatSwords = QueryOf<typeof RogueFlyingSwordCombatQuery>;

export const collideSwordBodyUnitySystem = defSystem(
    Update.fixed,
    collideSwordBodyUnity,
    [
        World,
        TimeState,
        Write(FusionPiercingCandidateState),
        CombatScratchState,
        EnemySpatialIndexState,
        RogueContentService,
        RogueSwordBodyUnityContactQuery,
        RogueFlyingSwordCombatQuery,
    ],
);

function collideSwordBodyUnity(
    world: World,
    time: Readonly<TimeState>,
    candidates: Mut<FusionPiercingCandidateState>,
    scratch: Readonly<CombatScratchState>,
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
            actions,
            piercingSequences,
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
        const actionStartTicks = actions[SwordBodyUnity.StartTick];
        const sequenceStartTicks =
            piercingSequences[
                SwordBodyUnityPiercingSequence.StartTick
            ];
        const piercingHitCounts =
            piercingSequences[
                SwordBodyUnityPiercingSequence.HitCount
            ];
        for (let row = 0; row < count; row++) {
            if (active[row] === 0) continue;
            const group = groups[row] as Entity;
            if (
                (scratch.groupMetalMaximumMomentum.get(group) ?? 0) >
                    0
            ) {
                if (
                    sequenceStartTicks[row] !== actionStartTicks[row]
                ) {
                    sequenceStartTicks[row] = actionStartTicks[row];
                    piercingHitCounts[row] = 0;
                }
                piercingHitCounts[row] =
                    collideFusionPiercingSegment(
                        world,
                        tick,
                        candidates,
                        content,
                        index,
                        entities[row],
                        group,
                        damages[row],
                        FUSION_HIT_RADIUS,
                        previousXs[row],
                        previousYs[row] + FUSION_BODY_HEIGHT,
                        previousZs[row],
                        xs[row],
                        ys[row] + FUSION_BODY_HEIGHT,
                        zs[row],
                        piercingHitCounts[row],
                    );
            } else {
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
            }
            collideFusionSwords(
                world,
                tick,
                content,
                index,
                entities[row],
                group,
                damages[row],
                swords,
            );
        }
    }
}

function collideFusionPiercingSegment(
    world: World,
    tick: number,
    candidates: Mut<FusionPiercingCandidateState>,
    content: RogueContentService,
    index: Readonly<EnemySpatialIndexState>,
    source: Entity,
    sourceGroup: Entity,
    damage: number,
    hitRadius: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    hitCount: number,
): number {
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
    candidates.reset();
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
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
                    const enemy = index.entities[candidate] as Entity;
                    const nextTick = world.get(
                        enemy,
                        FlyingSwordContactCooldownType,
                        FlyingSwordContactCooldown.FusionNextTick,
                    );
                    if (nextTick !== null && tick >= nextTick) {
                        candidates.insert(
                            candidate,
                            progressAlongSegment3(
                                index.xs[candidate],
                                index.ys[candidate],
                                index.zs[candidate],
                                startX,
                                startY,
                                startZ,
                                endX,
                                endY,
                                endZ,
                            ),
                        );
                    }
                }
                candidate = index.next[candidate];
            }
        }
    }
    candidates.sort(index.entities);
    for (let row = 0; row < candidates.count; row++) {
        const candidate = candidates.indices[row];
        const enemy = index.entities[candidate] as Entity;
        world.set(
            enemy,
            FlyingSwordContactCooldownType,
            FlyingSwordContactCooldown.FusionNextTick,
            tick + FUSION_CONTACT_COOLDOWN_TICKS,
        );
        content.requestPiercingFlyingSwordDamage(
            source,
            sourceGroup,
            enemy,
            damage,
            DamageKind.SwordBodyUnity,
            hitCount,
        );
        hitCount++;
    }
    return hitCount;
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
