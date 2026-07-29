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
    HealingKind,
    HealingRequest,
    HealingRequestType,
    Health,
    HealthType,
    LifeRegeneration,
    ResolvedHealing,
    ResolvedHealingType,
} from "./components";
import {
    RogueHealingRequestQuery,
    RogueLifeRegenerationQuery,
    RogueResolvedHealingQuery,
} from "./queries";
import { RogueEntityAccessState } from "./state";
import {
    RogueSystemSet,
} from "./systems";

type Regenerators = QueryOf<typeof RogueLifeRegenerationQuery>;
type HealingRequests = QueryOf<typeof RogueHealingRequestQuery>;
type ResolvedHealings = QueryOf<typeof RogueResolvedHealingQuery>;

export const generateLifeRegenerationSystem = defSystem(
    Update.fixed,
    generateLifeRegeneration,
    [TimeState, Commands, RogueLifeRegenerationQuery],
);

export const resolveHealingRequestsSystem = defSystem(
    Update.fixed,
    resolveHealingRequests,
    [
        Commands,
        World,
        Write(RogueEntityAccessState),
        RogueHealingRequestQuery,
    ],
);

export const cleanupHealingFactsSystem = defSystem(
    Update.fixed,
    cleanupHealingFacts,
    [Commands, RogueResolvedHealingQuery],
);

export const RecoverySystemOptions = Object.freeze({
    generate: {
        inSet: RogueSystemSet.RecoveryGenerate,
        after: RogueSystemSet.Clock,
        before: RogueSystemSet.RecoveryResolve,
    },
    resolve: {
        inSet: RogueSystemSet.RecoveryResolve,
        after: RogueSystemSet.RecoveryGenerate,
        before: RogueSystemSet.RecoveryCleanup,
    },
    cleanup: {
        inSet: RogueSystemSet.RecoveryCleanup,
        after: RogueSystemSet.RecoveryResolve,
        before: RogueSystemSet.Spawn,
    },
});

function generateLifeRegeneration(
    time: Readonly<TimeState>,
    commands: Commands,
    regenerators: Regenerators,
): void {
    if (!(time.delta > 0) || !Number.isFinite(time.delta)) return;
    const iter = regenerators.iter();
    while (iter.next()) {
        const [count, entities, health, regeneration] = iter.current;
        const currents = health[Health.Current];
        const maximums = health[Health.Maximum];
        const flatPerSeconds =
            regeneration[LifeRegeneration.FlatPerSecond];
        const maximumRatios =
            regeneration[LifeRegeneration.MaximumLifePerSecondRatio];
        for (let row = 0; row < count; row++) {
            if (currents[row] <= 0 || currents[row] >= maximums[row]) {
                continue;
            }
            const perSecond =
                finiteNonNegative(flatPerSeconds[row]) +
                finiteNonNegative(maximumRatios[row]) *
                    finiteNonNegative(maximums[row]);
            const amount = perSecond * time.delta;
            if (!(amount > 0) || !Number.isFinite(amount)) continue;
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
                    HealingKind.Regeneration,
                )
                .submit();
        }
    }
}

function resolveHealingRequests(
    commands: Commands,
    world: World,
    scratch: Mut<RogueEntityAccessState>,
    requests: HealingRequests,
): void {
    const healthComponent = world.findComponent(HealthType);
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const targets = data[HealingRequest.Target];
        const amounts = data[HealingRequest.Amount];
        for (let row = 0; row < count; row++) {
            let applied = 0;
            let overflow = finiteNonNegative(amounts[row]);
            if (
                healthComponent &&
                world.resolve(targets[row], access) &&
                access.archetype
            ) {
                const health = access.archetype.getComp(
                    access.row,
                    healthComponent.id,
                ) as ComponentColumns<HealthType> | null;
                if (health) {
                    const localRow =
                        access.archetype.rowIdxOf(access.row);
                    const currents = health[Health.Current];
                    const maximums = health[Health.Maximum];
                    calculateResolvedHealing(
                        currents[localRow],
                        maximums[localRow],
                        amounts[row],
                        resolvedHealingScratch,
                    );
                    applied = resolvedHealingScratch.applied;
                    overflow = resolvedHealingScratch.overflow;
                    if (applied > 0) currents[localRow] += applied;
                }
            }
            commands
                .entity(entities[row])
                .add(ResolvedHealingType)
                .set(
                    ResolvedHealingType,
                    ResolvedHealing.Applied,
                    applied,
                )
                .set(
                    ResolvedHealingType,
                    ResolvedHealing.Overflow,
                    overflow,
                )
                .submit();
        }
    }
}

function cleanupHealingFacts(
    commands: Commands,
    facts: ResolvedHealings,
): void {
    const iter = facts.iter();
    while (iter.next()) {
        const [count, entities] = iter.current;
        for (let row = 0; row < count; row++) {
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

export interface ResolvedHealingOut {
    applied: number;
    overflow: number;
}

export function calculateResolvedHealing(
    current: number,
    maximum: number,
    requested: number,
    out: ResolvedHealingOut,
): void {
    const amount = finiteNonNegative(requested);
    if (
        !(current > 0) ||
        !Number.isFinite(current) ||
        !Number.isFinite(maximum)
    ) {
        out.applied = 0;
        out.overflow = amount;
        return;
    }
    const available = Math.max(0, maximum - current);
    const applied = Math.min(amount, available);
    out.applied = applied;
    out.overflow = Math.max(0, amount - applied);
}

function finiteNonNegative(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
}

const resolvedHealingScratch: ResolvedHealingOut = {
    applied: 0,
    overflow: 0,
};
