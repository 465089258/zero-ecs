import {
    Update,
    defSystem,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import { FlyingSwordMember } from "../../../domain/flying-sword";
import { TimeState } from "@zero-ecs/game/time";
import { Float3 } from "../../../infrastructure/math";
import {
    DamageKind,
    FlyingSwordCombat,
    SwordAttack,
} from "../components";
import { RogueContentService } from "../content-service";
import { RogueFlyingSwordCombatQuery } from "../queries";
import {
    CombatScratchState,
    EnemySpatialIndexState,
    GRID_CELL_SIZE,
    GRID_HEIGHT,
    GRID_WIDTH,
} from "../state";
import {
    SWORD_HIT_RADIUS,
} from "./combat-constants";
import {
    clampGridCell,
    squaredDistanceToSegment3,
} from "./combat-spatial-index";
import { rollSwordDamage } from "./sword-loadout-system";

type CombatSwords = QueryOf<typeof RogueFlyingSwordCombatQuery>;

export const collideFormationSwordContactsSystem = defSystem(
    Update.fixed,
    collideFormationSwordContacts,
    [
        TimeState,
        CombatScratchState,
        EnemySpatialIndexState,
        RogueContentService,
        RogueFlyingSwordCombatQuery,
    ],
);

function collideFormationSwordContacts(
    time: Readonly<TimeState>,
    scratch: Readonly<CombatScratchState>,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    swords: CombatSwords,
): void {
    if (scratch.formationGroups.size === 0) return;
    const tick = time.tick;
    const iter = swords.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            previousPositions,
            positions,
            ,
            combat,
            attacks,
        ] = iter.current;
        const swordGroups = members[FlyingSwordMember.Group];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const nextAttackTicks =
            combat[FlyingSwordCombat.NextAttackTick];
        const sequences = combat[FlyingSwordCombat.AttackSequence];
        const minimumDamages = attacks[SwordAttack.MinimumDamage];
        const maximumDamages = attacks[SwordAttack.MaximumDamage];
        const attackIntervals =
            attacks[SwordAttack.AttackIntervalTicks];
        for (let row = 0; row < count; row++) {
            const sword = entities[row];
            const group = swordGroups[row] as Entity;
            if (
                !scratch.formationGroups.has(group) ||
                scratch.activeTaskSwords.has(sword) ||
                scratch.activeActionSwords.has(sword) ||
                tick < nextAttackTicks[row]
            ) {
                continue;
            }
            if (collideFormationSegment(
                tick,
                content,
                index,
                sword,
                group,
                scratch.groupFireBurstThresholds.has(group) ||
                    scratch.groupColdMaximumStacks.has(group),
                rollSwordDamage(
                    minimumDamages[row],
                    maximumDamages[row],
                    sword,
                    sequences[row] + 1,
                ) * (
                    scratch.groupFormationDamageMultipliers.get(
                        group,
                    ) ?? 1
                ),
                previousXs[row],
                previousYs[row],
                previousZs[row],
                xs[row],
                ys[row],
                zs[row],
            )) {
                sequences[row]++;
                nextAttackTicks[row] = tick + Math.min(
                    attackIntervals[row],
                    scratch.groupFormationContactCooldowns.get(
                        group,
                    ) ?? attackIntervals[row],
                );
            }
        }
    }
}

function collideFormationSegment(
    tick: number,
    content: RogueContentService,
    index: Readonly<EnemySpatialIndexState>,
    source: Entity,
    sourceGroup: Entity,
    sourceContextActive: boolean,
    damage: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): boolean {
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
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
                const enemy = index.entities[candidate] as Entity;
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
                    if (sourceContextActive) {
                        content.requestFlyingSwordDamage(
                            source,
                            sourceGroup,
                            enemy,
                            damage,
                            DamageKind.FormationSword,
                        );
                    } else {
                        content.requestDamage(
                            source,
                            enemy,
                            damage,
                            DamageKind.FormationSword,
                        );
                    }
                    return true;
                }
                candidate = index.next[candidate];
            }
        }
    }
    return false;
}
