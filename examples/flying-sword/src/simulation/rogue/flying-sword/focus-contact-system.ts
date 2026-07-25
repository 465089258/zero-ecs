import {
    INVALID_ENTITY,
    Update,
    defSystem,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordAction,
    FlyingSwordMember,
} from "@zero-ecs/flying-sword";
import { Float3 } from "@zero-ecs/math/3d";
import { FlyingSwordCombat } from "../components";
import { RogueContentService } from "../content-service";
import { RogueFlyingSwordContactQuery } from "../queries";
import {
    CombatScratchState,
    EnemySpatialIndexState,
} from "../state";
import { findClosestSwordSegmentHit } from "./combat-spatial-index";

type SwordContacts = QueryOf<typeof RogueFlyingSwordContactQuery>;

export const collideFocusSwordContactsSystem = defSystem(
    Update.fixed,
    collideFocusSwordContacts,
    [
        CombatScratchState,
        EnemySpatialIndexState,
        RogueContentService,
        RogueFlyingSwordContactQuery,
    ],
);

function collideFocusSwordContacts(
    scratch: Readonly<CombatScratchState>,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    contacts: SwordContacts,
): void {
    if (scratch.actionCount === 0) return;
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
            combat,
        ] = iter.current;
        const groupEntities = members[FlyingSwordMember.Group];
        const actionEntities = actions[FlyingSwordAction.Action];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const rememberedActions =
            combat[FlyingSwordCombat.FocusAction];
        const rememberedStartTicks =
            combat[FlyingSwordCombat.FocusActionStartTick];
        const hitConsumed =
            combat[FlyingSwordCombat.FocusHitConsumed];
        for (let row = 0; row < count; row++) {
            const actionEntity = actionEntities[row] as Entity;
            if (actionEntity === INVALID_ENTITY) continue;
            const action = findActionSnapshot(
                scratch,
                actionEntity,
                groupEntities[row] as Entity,
            );
            if (action < 0) continue;
            const actionStartTick = scratch.startTicks[action];
            if (
                rememberedActions[row] !== actionEntity ||
                rememberedStartTicks[row] !== actionStartTick
            ) {
                rememberedActions[row] = actionEntity;
                rememberedStartTicks[row] = actionStartTick;
                hitConsumed[row] = 0;
            }
            if (hitConsumed[row] !== 0) continue;
            const enemy = findClosestSwordSegmentHit(
                index,
                previousXs[row],
                previousYs[row],
                previousZs[row],
                xs[row],
                ys[row],
                zs[row],
            );
            if (enemy === INVALID_ENTITY) continue;
            hitConsumed[row] = 1;
            content.requestDamage(
                entities[row],
                enemy,
                scratch.damages[action],
            );
        }
    }
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
