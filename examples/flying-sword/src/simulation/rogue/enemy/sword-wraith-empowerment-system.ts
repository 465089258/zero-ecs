import {
    INVALID_ENTITY,
    Update,
    defSystem,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import { Float3 } from "@zero-ecs/math/3d";
import {
    MotionSystemSet,
    MoveTowards3,
} from "@zero-ecs/motion/3d";
import {
    EnemyCombat,
    EnemyEmpowerment,
    Health,
    RogueRunClock,
    RogueRunPhase,
    RogueRunStatus,
    SwordWraithEmpowerment,
} from "../components";
import {
    RogueEmpowerableEnemyQuery,
    RogueEnemyEmpowermentModifierQuery,
    RogueRunPhaseQuery,
    RogueSwordWraithEmpowermentQuery,
} from "../queries";
import {
    RogueSystemSet,
    updateEnemyIntentSystem,
} from "../systems";
import {
    resolveEnemyMovementSpeedSystem,
} from "./movement-speed-system";
import { resolveEnemyCombatSystem } from "./combat-system";

type Runs = QueryOf<typeof RogueRunPhaseQuery>;
type Sources = QueryOf<typeof RogueSwordWraithEmpowermentQuery>;
type Targets = QueryOf<typeof RogueEmpowerableEnemyQuery>;
type EmpoweredEnemies =
    QueryOf<typeof RogueEnemyEmpowermentModifierQuery>;

export const SWORD_WRAITH_PULSE_VISUAL_TICKS = 30;

export const pulseSwordWraithEmpowermentSystem = defSystem(
    Update.fixed,
    pulseSwordWraithEmpowerment,
    [
        RogueRunPhaseQuery,
        RogueSwordWraithEmpowermentQuery,
        RogueEmpowerableEnemyQuery,
    ],
);

export const applyEnemyEmpowermentModifiersSystem = defSystem(
    Update.fixed,
    applyEnemyEmpowermentModifiers,
    [
        RogueRunPhaseQuery,
        RogueEnemyEmpowermentModifierQuery,
    ],
);

export const SwordWraithEmpowermentSystemOptions = Object.freeze({
    pulse: {
        inSet: RogueSystemSet.Intent,
        after: updateEnemyIntentSystem,
        before: RogueSystemSet.EnemyResolve,
    },
    modifiers: {
        inSet: RogueSystemSet.EnemyResolve,
        after: [
            pulseSwordWraithEmpowermentSystem,
            resolveEnemyMovementSpeedSystem,
            resolveEnemyCombatSystem,
        ],
        before: MotionSystemSet.Integrate3,
    },
});

function pulseSwordWraithEmpowerment(
    runs: Runs,
    sources: Sources,
    targets: Targets,
): void {
    let playing = false;
    let tick = 0;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [count, , clocks, statuses] = runIter.current;
        if (count === 0) continue;
        tick = clocks[RogueRunClock.Tick][0];
        playing =
            statuses[RogueRunStatus.Phase][0] === RogueRunPhase.Playing;
        break;
    }
    if (!playing) return;

    const sourceIter = sources.iter();
    while (sourceIter.next()) {
        const [count, entities, positions, abilities] =
            sourceIter.current;
        const xs = positions[Float3.X];
        const zs = positions[Float3.Z];
        const radii =
            abilities[SwordWraithEmpowerment.Radius];
        const intervals =
            abilities[SwordWraithEmpowerment.IntervalTicks];
        const durations =
            abilities[SwordWraithEmpowerment.DurationTicks];
        const nextPulseTicks =
            abilities[SwordWraithEmpowerment.NextPulseTick];
        const speedMultipliers =
            abilities[SwordWraithEmpowerment.SpeedMultiplier];
        const damageMultipliers =
            abilities[
                SwordWraithEmpowerment.ContactDamageMultiplier
            ];
        const pulseEndTicks =
            abilities[SwordWraithEmpowerment.PulseEndTick];
        for (let row = 0; row < count; row++) {
            if (tick < nextPulseTicks[row]) continue;
            const interval = Math.max(1, intervals[row]);
            const duration = Math.max(1, durations[row]);
            const radius = Math.max(0, radii[row]);
            const speedMultiplier =
                Math.max(1, speedMultipliers[row]);
            const damageMultiplier =
                Math.max(1, damageMultipliers[row]);
            nextPulseTicks[row] = tick + interval;
            pulseEndTicks[row] =
                tick + SWORD_WRAITH_PULSE_VISUAL_TICKS;
            empowerEnemiesInRadius(
                targets,
                entities[row] as Entity,
                xs[row],
                zs[row],
                radius,
                tick,
                duration,
                speedMultiplier,
                damageMultiplier,
            );
        }
    }
}

function empowerEnemiesInRadius(
    targets: Targets,
    source: Entity,
    sourceX: number,
    sourceZ: number,
    radius: number,
    tick: number,
    duration: number,
    speedMultiplier: number,
    damageMultiplier: number,
): void {
    const targetIter = targets.iter();
    while (targetIter.next()) {
        const [
            count,
            entities,
            positions,
            health,
            empowerments,
        ] = targetIter.current;
        const xs = positions[Float3.X];
        const zs = positions[Float3.Z];
        const currentHealth = health[Health.Current];
        const sources = empowerments[EnemyEmpowerment.Source];
        const expireTicks =
            empowerments[EnemyEmpowerment.ExpireTick];
        const speedMultipliers =
            empowerments[EnemyEmpowerment.SpeedMultiplier];
        const damageMultipliers =
            empowerments[
                EnemyEmpowerment.ContactDamageMultiplier
            ];
        for (let row = 0; row < count; row++) {
            if (
                entities[row] === source ||
                currentHealth[row] <= 0 ||
                !isWithinSwordWraithEmpowerment(
                    sourceX,
                    sourceZ,
                    xs[row],
                    zs[row],
                    radius,
                )
            ) {
                continue;
            }
            if (
                tick < expireTicks[row] &&
                speedMultipliers[row] * damageMultipliers[row] >
                    speedMultiplier * damageMultiplier
            ) {
                continue;
            }
            sources[row] = source;
            expireTicks[row] = tick + duration;
            speedMultipliers[row] = speedMultiplier;
            damageMultipliers[row] = damageMultiplier;
        }
    }
}

function applyEnemyEmpowermentModifiers(
    runs: Runs,
    enemies: EmpoweredEnemies,
): void {
    let hasRun = false;
    let tick = 0;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [count, , clocks] = runIter.current;
        if (count === 0) continue;
        hasRun = true;
        tick = clocks[RogueRunClock.Tick][0];
        break;
    }
    if (!hasRun) return;

    const iter = enemies.iter();
    while (iter.next()) {
        const [count, , motions, combats, empowerments] =
            iter.current;
        const maximumSpeeds = motions[MoveTowards3.MaximumSpeed];
        const contactDamages = combats[EnemyCombat.ContactDamage];
        const sources = empowerments[EnemyEmpowerment.Source];
        const expireTicks =
            empowerments[EnemyEmpowerment.ExpireTick];
        const speedMultipliers =
            empowerments[EnemyEmpowerment.SpeedMultiplier];
        const damageMultipliers =
            empowerments[
                EnemyEmpowerment.ContactDamageMultiplier
            ];
        for (let row = 0; row < count; row++) {
            if (
                sources[row] === INVALID_ENTITY ||
                tick >= expireTicks[row]
            ) {
                sources[row] = INVALID_ENTITY;
                expireTicks[row] = 0;
                speedMultipliers[row] = 1;
                damageMultipliers[row] = 1;
                continue;
            }
            maximumSpeeds[row] *= speedMultipliers[row];
            contactDamages[row] *= damageMultipliers[row];
        }
    }
}

export function isWithinSwordWraithEmpowerment(
    sourceX: number,
    sourceZ: number,
    targetX: number,
    targetZ: number,
    radius: number,
): boolean {
    if (radius < 0) return false;
    const dx = targetX - sourceX;
    const dz = targetZ - sourceZ;
    return dx * dx + dz * dz <= radius * radius;
}
