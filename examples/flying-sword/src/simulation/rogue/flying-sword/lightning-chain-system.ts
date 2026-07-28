import {
    Commands,
    Update,
    World,
    Write,
    defSystem,
    type ComponentColumns,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    Float3,
    Position3Type,
} from "../../../infrastructure/math";
import {
    DamageKind,
    DamageRequest,
    EnemyBody,
    EnemyBodyType,
    FlyingSwordDamageSource,
    LightningArc,
} from "../components";
import { RogueContentService } from "../content-service";
import {
    RogueFlyingSwordDamageRequestQuery,
    RogueLightningArcQuery,
} from "../queries";
import {
    CombatScratchState,
    EnemySpatialIndexState,
    GRID_CELL_SIZE,
    GRID_HEIGHT,
    GRID_WIDTH,
    LightningChainAccessState,
} from "../state";
import { clampGridCell } from "./combat-spatial-index";

type DamageRequests =
    QueryOf<typeof RogueFlyingSwordDamageRequestQuery>;
type LightningArcs = QueryOf<typeof RogueLightningArcQuery>;

export const chainLightningDamageSystem = defSystem(
    Update.fixed,
    chainLightningDamage,
    [
        World,
        TimeState,
        Write(LightningChainAccessState),
        CombatScratchState,
        EnemySpatialIndexState,
        RogueContentService,
        RogueFlyingSwordDamageRequestQuery,
    ],
);

export const expireLightningArcsSystem = defSystem(
    Update.fixed,
    expireLightningArcs,
    [
        Commands,
        TimeState,
        RogueLightningArcQuery,
    ],
);

function chainLightningDamage(
    world: World,
    time: Readonly<TimeState>,
    accessState: Mut<LightningChainAccessState>,
    scratch: Readonly<CombatScratchState>,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    requests: DamageRequests,
): void {
    if (scratch.groupLightningChainCounts.size === 0) return;
    const positionId = world.findComponent(Position3Type)?.id;
    const bodyId = world.findComponent(EnemyBodyType)?.id;
    if (positionId === undefined || bodyId === undefined) return;
    const access = accessState.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, , data, sourceContexts] = iter.current;
        const sources = data[DamageRequest.Source];
        const targets = data[DamageRequest.Target];
        const amounts = data[DamageRequest.Amount];
        const kinds = data[DamageRequest.Kind];
        const sourceGroups =
            sourceContexts[FlyingSwordDamageSource.Group];
        for (let row = 0; row < count; row++) {
            if (!canTriggerLightningChain(kinds[row])) continue;
            const source = sources[row] as Entity;
            const group = sourceGroups[row] as Entity;
            if (
                (scratch.groupLightningChainCounts.get(group) ?? 0) === 0
            ) {
                continue;
            }
            const target = targets[row] as Entity;
            if (!world.resolve(target, access)) continue;
            const archetype = access.archetype;
            const positions = archetype?.getComp(
                access.row,
                positionId,
            ) as ComponentColumns<Position3Type> | null;
            const bodies = archetype?.getComp(
                access.row,
                bodyId,
            ) as ComponentColumns<EnemyBodyType> | null;
            if (!archetype || !positions || !bodies) continue;
            const targetRow = archetype.rowIdxOf(access.row);
            const startX = positions[Float3.X][targetRow];
            const startY =
                positions[Float3.Y][targetRow] +
                bodies[EnemyBody.CenterHeight][targetRow];
            const startZ = positions[Float3.Z][targetRow];
            const chainRadius =
                scratch.groupLightningChainRadii.get(group) ?? 0;
            const candidate = findClosestLightningChainCandidate(
                index,
                target,
                startX,
                startY,
                startZ,
                chainRadius,
            );
            if (candidate < 0) continue;
            const damage = lightningChainDamage(
                amounts[row],
                scratch.groupLightningDamageMultipliers.get(group) ??
                    0,
            );
            if (damage <= 0) continue;
            const chainedTarget =
                index.entities[candidate] as Entity;
            content.requestDamage(
                source,
                chainedTarget,
                damage,
                DamageKind.LightningChain,
            );
            content.spawnLightningArc(
                startX,
                startY,
                startZ,
                index.xs[candidate],
                index.ys[candidate],
                index.zs[candidate],
                time.tick,
                LIGHTNING_ARC_DURATION_TICKS,
            );
        }
    }
}

function expireLightningArcs(
    commands: Commands,
    time: Readonly<TimeState>,
    arcs: LightningArcs,
): void {
    const iter = arcs.iter();
    while (iter.next()) {
        const [count, entities, timing] = iter.current;
        const startTicks = timing[LightningArc.StartTick];
        const durations = timing[LightningArc.DurationTicks];
        for (let row = 0; row < count; row++) {
            if (time.tick - startTicks[row] < durations[row]) {
                continue;
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

export function canTriggerLightningChain(kind: number): boolean {
    return kind === DamageKind.ScatterSword ||
        kind === DamageKind.FocusSword;
}

export function lightningChainDamage(
    primaryDamage: number,
    multiplier: number,
): number {
    return Math.max(0, primaryDamage) * Math.max(0, multiplier);
}

/**
 * 返回空间索引中的最近候选下标；调用方直接复用索引列，不创建候选数组。
 */
export function findClosestLightningChainCandidate(
    index: Readonly<EnemySpatialIndexState>,
    excluded: Entity,
    originX: number,
    originY: number,
    originZ: number,
    radius: number,
): number {
    if (!(radius > 0)) return -1;
    const minimumCellX = clampGridCell(
        Math.floor(
            (originX - radius - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const maximumCellX = clampGridCell(
        Math.floor(
            (originX + radius - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const minimumCellZ = clampGridCell(
        Math.floor(
            (originZ - radius - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    const maximumCellZ = clampGridCell(
        Math.floor(
            (originZ + radius - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    const radiusSquared = radius * radius;
    let closest = -1;
    let closestDistance = radiusSquared;
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
                if (index.entities[candidate] !== excluded) {
                    const dx = index.xs[candidate] - originX;
                    const dy = index.ys[candidate] - originY;
                    const dz = index.zs[candidate] - originZ;
                    const distance =
                        dx * dx + dy * dy + dz * dz;
                    if (
                        distance < closestDistance ||
                        (
                            distance === closestDistance &&
                            (
                                closest < 0 ||
                                index.entities[candidate] <
                                    index.entities[closest]
                            )
                        )
                    ) {
                        closestDistance = distance;
                        closest = candidate;
                    }
                }
                candidate = index.next[candidate];
            }
        }
    }
    return closest;
}

export const LIGHTNING_ARC_DURATION_TICKS = 8;
