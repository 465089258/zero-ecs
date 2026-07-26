import {
    INVALID_ENTITY,
    Update,
    World,
    Write,
    defSystem,
    type ComponentColumns,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordAction,
    FlyingSwordMember,
} from "@zero-ecs/flying-sword";
import { Float3 } from "@zero-ecs/math/3d";
import {
    DamageKind,
    FocusSwordHitHistory,
    FocusSwordHitHistoryType,
} from "../components";
import { RogueContentService } from "../content-service";
import { RogueFlyingSwordContactQuery } from "../queries";
import {
    CombatScratchState,
    EnemySpatialIndexState,
    FocusSwordContactAccessState,
    GRID_CELL_SIZE,
    GRID_HEIGHT,
    GRID_WIDTH,
} from "../state";
import {
    FOCUS_PIERCING_HEIGHT,
    SWORD_HIT_RADIUS,
} from "./combat-constants";
import {
    clampGridCell,
    squaredDistanceToSegment3,
} from "./combat-spatial-index";

type SwordContacts = QueryOf<typeof RogueFlyingSwordContactQuery>;
type HitHistoryComponentId =
    NonNullable<ReturnType<World["findComponent"]>>["id"];

export const collideFocusSwordContactsSystem = defSystem(
    Update.fixed,
    collideFocusSwordContacts,
    [
        World,
        Write(FocusSwordContactAccessState),
        CombatScratchState,
        EnemySpatialIndexState,
        RogueContentService,
        RogueFlyingSwordContactQuery,
    ],
);

function collideFocusSwordContacts(
    world: World,
    accessState: Mut<FocusSwordContactAccessState>,
    scratch: Readonly<CombatScratchState>,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    contacts: SwordContacts,
): void {
    if (scratch.actionCount === 0) return;
    const hitHistoryComponentId = world.findComponent(
        FocusSwordHitHistoryType,
    )?.id;
    if (hitHistoryComponentId === undefined) return;
    const iter = contacts.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            actions,
            ,
            previousPositions,
            positions,
            ,
        ] = iter.current;
        const groupEntities = members[FlyingSwordMember.Group];
        const slots = members[FlyingSwordMember.Slot];
        const actionEntities = actions[FlyingSwordAction.Action];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        for (let row = 0; row < count; row++) {
            const actionEntity = actionEntities[row] as Entity;
            if (actionEntity === INVALID_ENTITY) continue;
            const action = findActionSnapshot(
                scratch,
                actionEntity,
                groupEntities[row] as Entity,
            );
            if (action < 0) continue;
            const startRatio = focusPiercingSegmentStartRatio(
                previousYs[row],
                ys[row],
                FOCUS_PIERCING_HEIGHT,
            );
            if (startRatio < 0) continue;
            const startX =
                previousXs[row] +
                (xs[row] - previousXs[row]) * startRatio;
            const startY =
                previousYs[row] +
                (ys[row] - previousYs[row]) * startRatio;
            const startZ =
                previousZs[row] +
                (zs[row] - previousZs[row]) * startRatio;
            collideFocusSegment(
                world,
                accessState,
                hitHistoryComponentId,
                content,
                index,
                entities[row],
                groupEntities[row] as Entity,
                actionEntity,
                slots[row],
                scratch.damages[action],
                startX,
                startY,
                startZ,
                xs[row],
                ys[row],
                zs[row],
            );
        }
    }
}

function collideFocusSegment(
    world: World,
    accessState: Mut<FocusSwordContactAccessState>,
    hitHistoryComponentId: HitHistoryComponentId,
    content: RogueContentService,
    index: Readonly<EnemySpatialIndexState>,
    source: Entity,
    sourceGroup: Entity,
    action: Entity,
    slot: number,
    damage: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): void {
    const padding = 1.4;
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
    const access = accessState.access;
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
                const radius =
                    index.radii[candidate] + SWORD_HIT_RADIUS;
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
                    const enemy =
                        index.entities[candidate] as Entity;
                    if (world.resolve(enemy, access)) {
                        const archetype = access.archetype;
                        const hitHistory = archetype?.getComp(
                            access.row,
                            hitHistoryComponentId,
                        ) as ComponentColumns<
                            FocusSwordHitHistoryType
                        > | null;
                        if (archetype && hitHistory) {
                            const row =
                                archetype.rowIdxOf(access.row);
                            if (
                                recordFocusSwordHit(
                                    hitHistory[
                                        FocusSwordHitHistory.Action
                                    ],
                                    hitHistory[
                                        FocusSwordHitHistory
                                            .SwordMaskLow
                                    ],
                                    hitHistory[
                                        FocusSwordHitHistory
                                            .SwordMaskHigh
                                    ],
                                    row,
                                    action,
                                    slot,
                                )
                            ) {
                                content.requestFlyingSwordDamage(
                                    source,
                                    sourceGroup,
                                    enemy,
                                    damage,
                                    DamageKind.FocusSword,
                                );
                            }
                        }
                    }
                }
                candidate = index.next[candidate];
            }
        }
    }
}

/**
 * 返回低空杀伤段在本帧扫掠线段上的起点比例；负数表示尚未下降到阈值。
 */
export function focusPiercingSegmentStartRatio(
    startY: number,
    endY: number,
    maximumHeight: number,
): number {
    if (endY > maximumHeight) return -1;
    if (startY <= maximumHeight) return 0;
    const descent = startY - endY;
    return descent > 1e-6
        ? Math.min(1, (startY - maximumHeight) / descent)
        : -1;
}

/**
 * 记录同次集火中某个槽位对敌人的首次命中。
 *
 * 示例当前最多 49 把剑，因此两个 U32 掩码可以无分配地覆盖全部槽位。
 */
export function recordFocusSwordHit(
    actions: Uint32Array,
    lowMasks: Uint32Array,
    highMasks: Uint32Array,
    row: number,
    action: Entity,
    slot: number,
): boolean {
    if (!Number.isInteger(slot) || slot < 0 || slot >= 64) {
        return false;
    }
    if (actions[row] !== action) {
        actions[row] = action;
        lowMasks[row] = 0;
        highMasks[row] = 0;
    }
    const bit = (1 << (slot & 31)) >>> 0;
    const masks = slot < 32 ? lowMasks : highMasks;
    if ((masks[row] & bit) !== 0) return false;
    masks[row] = (masks[row] | bit) >>> 0;
    return true;
}

function findActionSnapshot(
    scratch: Readonly<CombatScratchState>,
    actionEntity: Entity,
    group: Entity,
): number {
    const actionEntities = scratch.actionEntities;
    const actionGroups = scratch.actionGroups;
    for (let index = 0; index < scratch.actionCount; index++) {
        if (
            actionEntities[index] === actionEntity &&
            actionGroups[index] === group
        ) {
            return index;
        }
    }
    return -1;
}
