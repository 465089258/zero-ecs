import {
    Update,
    defSystem,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import {
    DamageKind,
    DamageRequest,
    FlyingSwordDamageSource,
    PiercingDamage,
} from "../components";
import { RogueContentService } from "../content-service";
import {
    RoguePiercingFlyingSwordDamageRequestQuery,
} from "../queries";
import { CombatScratchState } from "../state";

type PiercingDamageRequests =
    QueryOf<typeof RoguePiercingFlyingSwordDamageRequestQuery>;

export const applyMetalBreakSystem = defSystem(
    Update.fixed,
    applyMetalBreak,
    [
        CombatScratchState,
        RogueContentService,
        RoguePiercingFlyingSwordDamageRequestQuery,
    ],
);

function applyMetalBreak(
    scratch: Readonly<CombatScratchState>,
    content: RogueContentService,
    requests: PiercingDamageRequests,
): void {
    if (scratch.groupMetalMaximumMomentum.size === 0) return;
    const iter = requests.iter();
    while (iter.next()) {
        const [
            count,
            ,
            damageRequests,
            sourceContexts,
            piercingContexts,
        ] = iter.current;
        const sources = damageRequests[DamageRequest.Source];
        const targets = damageRequests[DamageRequest.Target];
        const amounts = damageRequests[DamageRequest.Amount];
        const kinds = damageRequests[DamageRequest.Kind];
        const groups =
            sourceContexts[FlyingSwordDamageSource.Group];
        const priorHits =
            piercingContexts[PiercingDamage.PriorHits];
        for (let row = 0; row < count; row++) {
            if (!canTriggerMetalBreak(kinds[row])) continue;
            const group = groups[row] as Entity;
            const damage = metalBreakDamage(
                amounts[row],
                priorHits[row],
                scratch.groupMetalMaximumMomentum.get(group) ?? 0,
                scratch.groupMetalDamagePerMomentum.get(group) ?? 0,
            );
            if (damage <= 0) continue;
            content.requestDamage(
                sources[row] as Entity,
                targets[row] as Entity,
                damage,
                DamageKind.MetalBreak,
            );
        }
    }
}

export function canTriggerMetalBreak(kind: number): boolean {
    return kind === DamageKind.FocusSword ||
        kind === DamageKind.SwordBodyUnity;
}

export function metalBreakDamage(
    primaryDamage: number,
    priorHits: number,
    maximumMomentum: number,
    damagePerMomentum: number,
): number {
    const momentum = Math.min(
        Math.max(0, Math.floor(priorHits)),
        Math.max(0, Math.floor(maximumMomentum)),
    );
    return Math.max(0, primaryDamage) *
        momentum *
        Math.max(0, damagePerMomentum);
}
