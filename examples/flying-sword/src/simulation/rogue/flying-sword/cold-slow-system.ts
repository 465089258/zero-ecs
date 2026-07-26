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
import { TimeState } from "@zero-ecs/game/time";
import {
    MoveTowards3,
    MoveTowards3Type,
} from "@zero-ecs/motion/3d";
import {
    DamageKind,
    DamageRequest,
    EnemyBody,
    EnemyBodyType,
    EnemyColdAccumulation,
    EnemyColdAccumulationType,
    FlyingSwordDamageSource,
} from "../components";
import {
    RogueColdEnemyQuery,
    RogueFlyingSwordDamageRequestQuery,
} from "../queries";
import {
    ColdSwordIntentAccessState,
    CombatScratchState,
} from "../state";

type ColdEnemies = QueryOf<typeof RogueColdEnemyQuery>;
type FlyingSwordDamageRequests =
    QueryOf<typeof RogueFlyingSwordDamageRequestQuery>;

export const applyColdSwordIntentSystem = defSystem(
    Update.fixed,
    applyColdSwordIntent,
    [
        World,
        TimeState,
        Write(ColdSwordIntentAccessState),
        CombatScratchState,
        RogueColdEnemyQuery,
        RogueFlyingSwordDamageRequestQuery,
    ],
);

function applyColdSwordIntent(
    world: World,
    time: Readonly<TimeState>,
    accessState: Mut<ColdSwordIntentAccessState>,
    scratch: Readonly<CombatScratchState>,
    enemies: ColdEnemies,
    requests: FlyingSwordDamageRequests,
): void {
    maintainColdAccumulations(time.tick, scratch, enemies);
    if (scratch.groupColdMaximumStacks.size === 0) return;
    const accumulationId = world.findComponent(
        EnemyColdAccumulationType,
    )?.id;
    const bodyId = world.findComponent(EnemyBodyType)?.id;
    const motionId = world.findComponent(MoveTowards3Type)?.id;
    if (
        accumulationId === undefined ||
        bodyId === undefined ||
        motionId === undefined
    ) {
        return;
    }
    const access = accessState.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, , data, sourceContexts] = iter.current;
        const targets = data[DamageRequest.Target];
        const kinds = data[DamageRequest.Kind];
        const groups =
            sourceContexts[FlyingSwordDamageSource.Group];
        for (let row = 0; row < count; row++) {
            if (!canTriggerColdSlow(kinds[row])) continue;
            const group = groups[row] as Entity;
            const maximumStacks =
                scratch.groupColdMaximumStacks.get(group) ?? 0;
            if (maximumStacks <= 0) continue;
            const target = targets[row] as Entity;
            if (!world.resolve(target, access)) continue;
            const archetype = access.archetype;
            const accumulations = archetype?.getComp(
                access.row,
                accumulationId,
            ) as ComponentColumns<EnemyColdAccumulationType> | null;
            const bodies = archetype?.getComp(
                access.row,
                bodyId,
            ) as ComponentColumns<EnemyBodyType> | null;
            const motions = archetype?.getComp(
                access.row,
                motionId,
            ) as ComponentColumns<MoveTowards3Type> | null;
            if (!archetype || !accumulations || !bodies || !motions) {
                continue;
            }
            const targetRow = archetype.rowIdxOf(access.row);
            const sourceGroups =
                accumulations[EnemyColdAccumulation.SourceGroup];
            const stacks =
                accumulations[EnemyColdAccumulation.Stacks];
            const expireTicks =
                accumulations[EnemyColdAccumulation.ExpireTick];
            if (sourceGroups[targetRow] !== group) {
                sourceGroups[targetRow] = group;
                stacks[targetRow] = 0;
            }
            const nextStacks = Math.min(
                maximumStacks,
                stacks[targetRow] + 1,
            );
            stacks[targetRow] = nextStacks;
            expireTicks[targetRow] =
                time.tick +
                (scratch.groupColdDurationTicks.get(group) ?? 0);
            motions[MoveTowards3.MaximumSpeed][targetRow] =
                bodies[EnemyBody.MoveSpeed][targetRow] *
                coldSpeedMultiplier(
                    nextStacks,
                    scratch.groupColdSlowPerStack.get(group) ?? 0,
                );
        }
    }
}

function maintainColdAccumulations(
    tick: number,
    scratch: Readonly<CombatScratchState>,
    enemies: ColdEnemies,
): void {
    const iter = enemies.iter();
    while (iter.next()) {
        const [count, , bodies, motions, accumulations] =
            iter.current;
        const baseSpeeds = bodies[EnemyBody.MoveSpeed];
        const maximumSpeeds = motions[MoveTowards3.MaximumSpeed];
        const sourceGroups =
            accumulations[EnemyColdAccumulation.SourceGroup];
        const stacks =
            accumulations[EnemyColdAccumulation.Stacks];
        const expireTicks =
            accumulations[EnemyColdAccumulation.ExpireTick];
        for (let row = 0; row < count; row++) {
            if (stacks[row] === 0) continue;
            const group = sourceGroups[row] as Entity;
            const slowPerStack =
                scratch.groupColdSlowPerStack.get(group);
            if (slowPerStack === undefined || tick >= expireTicks[row]) {
                sourceGroups[row] = INVALID_ENTITY;
                stacks[row] = 0;
                expireTicks[row] = 0;
                maximumSpeeds[row] = baseSpeeds[row];
                continue;
            }
            maximumSpeeds[row] =
                baseSpeeds[row] *
                coldSpeedMultiplier(stacks[row], slowPerStack);
        }
    }
}

export function canTriggerColdSlow(kind: number): boolean {
    return kind === DamageKind.ScatterSword ||
        kind === DamageKind.FormationSword;
}

export function coldSpeedMultiplier(
    stacks: number,
    slowPerStack: number,
): number {
    return Math.max(
        MINIMUM_COLD_SPEED_MULTIPLIER,
        1 -
            Math.max(0, Math.floor(stacks)) *
                Math.max(0, slowPerStack),
    );
}

export const MINIMUM_COLD_SPEED_MULTIPLIER = 0.4;
