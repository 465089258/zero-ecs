import {
    Commands,
    Update,
    World,
    Write,
    defSystem,
    type ComponentColumns,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    DamageAttribution,
    DamageRequest,
    HealingKind,
    HealingRequest,
    HealingRequestType,
    Health,
    HealthType,
    LifeLeechRuntime,
    LifeLeechRuntimeType,
    LifeLeechStats,
    LifeLeechStatsType,
    ResolvedDamage,
    SwordLifeLeech,
    SwordLifeLeechType,
} from "./components";
import {
    RogueLeechEligibleDamageQuery,
    RogueLifeLeechBeneficiaryQuery,
    RogueResolvedDamageQuery,
} from "./queries";
import { RogueEntityAccessState } from "./state";
import { RogueSystemSet } from "./systems";

type EligibleDamage = QueryOf<typeof RogueLeechEligibleDamageQuery>;
type Beneficiaries = QueryOf<typeof RogueLifeLeechBeneficiaryQuery>;
type ResolvedDamageFacts = QueryOf<typeof RogueResolvedDamageQuery>;

export const generateLifeLeechRecoverySystem = defSystem(
    Update.fixed,
    generateLifeLeechRecovery,
    [TimeState, Commands, RogueLifeLeechBeneficiaryQuery],
);

export const accumulateLifeLeechSystem = defSystem(
    Update.fixed,
    accumulateLifeLeech,
    [
        World,
        Write(RogueEntityAccessState),
        RogueLeechEligibleDamageQuery,
    ],
);

export const cleanupResolvedDamageFactsSystem = defSystem(
    Update.fixed,
    cleanupResolvedDamageFacts,
    [Commands, RogueResolvedDamageQuery],
);

export const LifeLeechSystemOptions = Object.freeze({
    generate: {
        inSet: RogueSystemSet.RecoveryGenerate,
        after: RogueSystemSet.Clock,
        before: RogueSystemSet.RecoveryResolve,
    },
    accumulate: {
        inSet: RogueSystemSet.LeechAccumulate,
        after: RogueSystemSet.Damage,
        before: RogueSystemSet.DamageCleanup,
    },
    cleanup: {
        inSet: RogueSystemSet.DamageCleanup,
        after: RogueSystemSet.LeechAccumulate,
        before: RogueSystemSet.Death,
    },
});

function generateLifeLeechRecovery(
    time: Readonly<TimeState>,
    commands: Commands,
    beneficiaries: Beneficiaries,
): void {
    if (!(time.delta > 0) || !Number.isFinite(time.delta)) return;
    const iter = beneficiaries.iter();
    while (iter.next()) {
        const [count, entities, health, stats, runtime] = iter.current;
        const currents = health[Health.Current];
        const maximums = health[Health.Maximum];
        const releaseDurations = stats[LifeLeechStats.ReleaseDuration];
        const maximumRecoveryRatios =
            stats[LifeLeechStats.MaximumRecoveryPerSecondRatio];
        const storedValues = runtime[LifeLeechRuntime.Stored];
        for (let row = 0; row < count; row++) {
            const current = currents[row];
            const maximum = maximums[row];
            if (
                !(current > 0) ||
                current >= maximum ||
                !(storedValues[row] > 0)
            ) {
                if (current <= 0 || current >= maximum) {
                    storedValues[row] = 0;
                }
                continue;
            }
            const amount = calculateLifeLeechRelease(
                storedValues[row],
                maximum,
                releaseDurations[row],
                maximumRecoveryRatios[row],
                time.delta,
            );
            if (!(amount > 0) || !Number.isFinite(amount)) continue;
            storedValues[row] -= amount;
            commands
                .spawn()
                .add(HealingRequestType)
                .set(
                    HealingRequestType,
                    HealingRequest.Source,
                    entities[row],
                )
                .set(
                    HealingRequestType,
                    HealingRequest.Target,
                    entities[row],
                )
                .set(
                    HealingRequestType,
                    HealingRequest.Amount,
                    amount,
                )
                .set(
                    HealingRequestType,
                    HealingRequest.Kind,
                    HealingKind.Leech,
                )
                .submit();
        }
    }
}

function accumulateLifeLeech(
    world: World,
    scratch: Mut<RogueEntityAccessState>,
    facts: EligibleDamage,
): void {
    const healthComponent = world.findComponent(HealthType);
    const statsComponent = world.findComponent(LifeLeechStatsType);
    const runtimeComponent = world.findComponent(LifeLeechRuntimeType);
    if (!healthComponent || !statsComponent || !runtimeComponent) {
        return;
    }
    const access = scratch.access;
    const iter = facts.iter();
    while (iter.next()) {
        const [
            count,
            ,
            damage,
            resolved,
            attribution,
        ] = iter.current;
        const sources = damage[DamageRequest.Source];
        const appliedDamages = resolved[ResolvedDamage.Applied];
        const beneficiaries =
            attribution[DamageAttribution.Beneficiary];
        for (let row = 0; row < count; row++) {
            const beneficiary = beneficiaries[row];
            if (
                !world.resolve(beneficiary, access) ||
                !access.archetype
            ) continue;
            const health = access.archetype.getComp(
                access.row,
                healthComponent.id,
            ) as ComponentColumns<HealthType> | null;
            const stats = access.archetype.getComp(
                access.row,
                statsComponent.id,
            ) as ComponentColumns<LifeLeechStatsType> | null;
            const runtime = access.archetype.getComp(
                access.row,
                runtimeComponent.id,
            ) as ComponentColumns<LifeLeechRuntimeType> | null;
            if (!health || !stats || !runtime) continue;
            const localRow = access.archetype.rowIdxOf(access.row);
            if (health[Health.Current][localRow] <= 0) continue;
            const swordRatio = world.get(
                sources[row],
                SwordLifeLeechType,
                SwordLifeLeech.DamageRatio,
            ) ?? 0;
            calculateLifeLeechStorage(
                appliedDamages[row],
                health[Health.Maximum][localRow],
                stats[LifeLeechStats.GlobalDamageRatio][localRow],
                swordRatio,
                stats[LifeLeechStats.MaximumPerHitRatio][localRow],
                runtime[LifeLeechRuntime.Stored][localRow],
                stats[LifeLeechStats.MaximumStoredRatio][localRow],
                lifeLeechScratch,
            );
            runtime[LifeLeechRuntime.Stored][localRow] =
                lifeLeechScratch.stored;
        }
    }
}

function cleanupResolvedDamageFacts(
    commands: Commands,
    facts: ResolvedDamageFacts,
): void {
    const iter = facts.iter();
    while (iter.next()) {
        const [count, entities] = iter.current;
        for (let row = 0; row < count; row++) {
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

export interface LifeLeechStorageOut {
    gain: number;
    stored: number;
}

export function calculateLifeLeechRelease(
    stored: number,
    maximumLife: number,
    releaseDuration: number,
    maximumRecoveryPerSecondRatio: number,
    delta: number,
): number {
    const available = finiteNonNegative(stored);
    const duration = positiveOr(
        releaseDuration,
        DEFAULT_LEECH_RELEASE_DURATION,
    );
    const maximumRate =
        finiteNonNegative(maximumLife) *
        finiteNonNegative(maximumRecoveryPerSecondRatio);
    const releaseRate = Math.min(available / duration, maximumRate);
    return Math.min(
        available,
        releaseRate * finiteNonNegative(delta),
    );
}

export function calculateLifeLeechStorage(
    appliedDamage: number,
    maximumLife: number,
    globalDamageRatio: number,
    swordDamageRatio: number,
    maximumPerHitRatio: number,
    currentStored: number,
    maximumStoredRatio: number,
    out: LifeLeechStorageOut,
): void {
    const maximum = finiteNonNegative(maximumLife);
    const damage = finiteNonNegative(appliedDamage);
    const ratio =
        finiteNonNegative(globalDamageRatio) +
        finiteNonNegative(swordDamageRatio);
    const perHitCap =
        maximum * finiteNonNegative(maximumPerHitRatio);
    const storageCap =
        maximum * finiteNonNegative(maximumStoredRatio);
    const rawGain = Math.min(damage * ratio, perHitCap);
    const stored = Math.min(
        storageCap,
        finiteNonNegative(currentStored) + rawGain,
    );
    out.gain = Math.max(0, stored - finiteNonNegative(currentStored));
    out.stored = stored;
}

function finiteNonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function positiveOr(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

const DEFAULT_LEECH_RELEASE_DURATION = 3.33;
const lifeLeechScratch: LifeLeechStorageOut = {
    gain: 0,
    stored: 0,
};
