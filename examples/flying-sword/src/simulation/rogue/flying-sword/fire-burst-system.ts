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
    EnemyFireAccumulation,
    EnemyFireAccumulationType,
    FireBurst,
    FlyingSwordDamageSource,
} from "../components";
import { RogueContentService } from "../content-service";
import {
    RogueFireBurstQuery,
    RogueFlyingSwordDamageRequestQuery,
} from "../queries";
import {
    CombatScratchState,
    EnemySpatialIndexState,
    FireSwordIntentAccessState,
    GRID_CELL_SIZE,
    GRID_HEIGHT,
    GRID_WIDTH,
} from "../state";
import { clampGridCell } from "./combat-spatial-index";

type FlyingSwordDamageRequests =
    QueryOf<typeof RogueFlyingSwordDamageRequestQuery>;
type FireBursts = QueryOf<typeof RogueFireBurstQuery>;

export const applyFireSwordIntentSystem = defSystem(
    Update.fixed,
    applyFireSwordIntent,
    [
        World,
        TimeState,
        Write(FireSwordIntentAccessState),
        CombatScratchState,
        EnemySpatialIndexState,
        RogueContentService,
        RogueFlyingSwordDamageRequestQuery,
    ],
);

export const expireFireBurstsSystem = defSystem(
    Update.fixed,
    expireFireBursts,
    [
        Commands,
        TimeState,
        RogueFireBurstQuery,
    ],
);

function applyFireSwordIntent(
    world: World,
    time: Readonly<TimeState>,
    accessState: Mut<FireSwordIntentAccessState>,
    scratch: Readonly<CombatScratchState>,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    requests: FlyingSwordDamageRequests,
): void {
    if (scratch.groupFireBurstThresholds.size === 0) return;
    const accumulationId = world.findComponent(
        EnemyFireAccumulationType,
    )?.id;
    const positionId = world.findComponent(Position3Type)?.id;
    if (accumulationId === undefined || positionId === undefined) {
        return;
    }
    const access = accessState.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, , data, sourceContexts] = iter.current;
        const sources = data[DamageRequest.Source];
        const targets = data[DamageRequest.Target];
        const amounts = data[DamageRequest.Amount];
        const kinds = data[DamageRequest.Kind];
        const groups =
            sourceContexts[FlyingSwordDamageSource.Group];
        for (let row = 0; row < count; row++) {
            if (!canTriggerFireBurst(kinds[row])) continue;
            const group = groups[row] as Entity;
            const threshold =
                scratch.groupFireBurstThresholds.get(group) ?? 0;
            if (threshold <= 0) continue;
            const target = targets[row] as Entity;
            if (!world.resolve(target, access)) continue;
            const archetype = access.archetype;
            const accumulations = archetype?.getComp(
                access.row,
                accumulationId,
            ) as ComponentColumns<EnemyFireAccumulationType> | null;
            const positions = archetype?.getComp(
                access.row,
                positionId,
            ) as ComponentColumns<Position3Type> | null;
            if (!archetype || !accumulations || !positions) continue;
            const targetRow = archetype.rowIdxOf(access.row);
            const sourceGroups =
                accumulations[EnemyFireAccumulation.SourceGroup];
            const stacks =
                accumulations[EnemyFireAccumulation.Stacks];
            if (sourceGroups[targetRow] !== group) {
                sourceGroups[targetRow] = group;
                stacks[targetRow] = 0;
            }
            const nextStacks = stacks[targetRow] + 1;
            if (nextStacks < threshold) {
                stacks[targetRow] = nextStacks;
                continue;
            }
            stacks[targetRow] = 0;
            const x = positions[Float3.X][targetRow];
            const y = positions[Float3.Y][targetRow] + 0.45;
            const z = positions[Float3.Z][targetRow];
            const radius =
                scratch.groupFireBurstRadii.get(group) ?? 0;
            const damage = fireBurstDamage(
                amounts[row],
                scratch.groupFireBurstDamageMultipliers.get(group) ??
                    0,
            );
            if (radius <= 0 || damage <= 0) continue;
            requestFireBurstDamage(
                content,
                index,
                sources[row] as Entity,
                x,
                z,
                radius,
                damage,
            );
            content.spawnFireBurst(
                x,
                y,
                z,
                radius,
                time.tick,
                FIRE_BURST_DURATION_TICKS,
            );
        }
    }
}

function requestFireBurstDamage(
    content: RogueContentService,
    index: Readonly<EnemySpatialIndexState>,
    source: Entity,
    originX: number,
    originZ: number,
    radius: number,
    damage: number,
): void {
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
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
                const dx = index.xs[candidate] - originX;
                const dz = index.zs[candidate] - originZ;
                const hitRadius = radius + index.radii[candidate];
                if (dx * dx + dz * dz <= hitRadius * hitRadius) {
                    content.requestDamage(
                        source,
                        index.entities[candidate] as Entity,
                        damage,
                        DamageKind.FireBurst,
                    );
                }
                candidate = index.next[candidate];
            }
        }
    }
}

function expireFireBursts(
    commands: Commands,
    time: Readonly<TimeState>,
    bursts: FireBursts,
): void {
    const iter = bursts.iter();
    while (iter.next()) {
        const [count, entities, , timing] = iter.current;
        const startTicks = timing[FireBurst.StartTick];
        const durations = timing[FireBurst.DurationTicks];
        for (let row = 0; row < count; row++) {
            if (time.tick - startTicks[row] < durations[row]) {
                continue;
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

export function canTriggerFireBurst(kind: number): boolean {
    return kind === DamageKind.FocusSword ||
        kind === DamageKind.FormationSword;
}

export function fireBurstDamage(
    primaryDamage: number,
    multiplier: number,
): number {
    return Math.max(0, primaryDamage) * Math.max(0, multiplier);
}

export const FIRE_BURST_DURATION_TICKS = 12;
