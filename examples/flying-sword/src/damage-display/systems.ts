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
    Float3,
    Position3Type,
} from "@zero-ecs/math/3d";
import { CultivatorTag } from "../simulation/components";
import {
    DamageRequest,
} from "../simulation/rogue/components";
import { resolveRogueDamageSystem } from "../simulation/rogue/systems";
import {
    DamageDisplay,
    DamageDisplayCapturedTag,
    DamageDisplayStyle,
    DamageDisplayType,
} from "./components";
import {
    DamageDisplayQuery,
    DamageDisplaySourceQuery,
} from "./queries";
import { DamageDisplayAccessState } from "./state";

type Sources = QueryOf<typeof DamageDisplaySourceQuery>;
type Displays = QueryOf<typeof DamageDisplayQuery>;

export const captureDamageDisplaysSystem = defSystem(
    Update.fixed,
    captureDamageDisplays,
    [
        TimeState,
        Commands,
        World,
        Write(DamageDisplayAccessState),
        DamageDisplaySourceQuery,
    ],
);

export const expireDamageDisplaysSystem = defSystem(
    Update.fixed,
    expireDamageDisplays,
    [TimeState, Commands, DamageDisplayQuery],
);

export const DamageDisplaySystemOptions = Object.freeze({
    capture: {
        beforeIfPresent: resolveRogueDamageSystem,
    } as const,
    expire: {
        after: captureDamageDisplaysSystem,
    } as const,
});

function captureDamageDisplays(
    time: Readonly<TimeState>,
    commands: Commands,
    world: World,
    scratch: Mut<DamageDisplayAccessState>,
    sources: Sources,
): void {
    const positionId = world.findComponent(Position3Type)?.id;
    const access = scratch.access;
    const iter = sources.iter();
    while (iter.next()) {
        const [count, entities, requests] = iter.current;
        const targets = requests[DamageRequest.Target];
        const amounts = requests[DamageRequest.Amount];
        for (let row = 0; row < count; row++) {
            const request = entities[row];
            commands
                .entity(request)
                .add(DamageDisplayCapturedTag)
                .submit();
            const amount = amounts[row];
            if (
                amount <= 0 ||
                positionId === undefined ||
                !world.resolve(targets[row], access)
            ) {
                continue;
            }
            const archetype = access.archetype;
            const positions = archetype?.getComp(
                access.row,
                positionId,
            ) as ComponentColumns<Position3Type> | null;
            if (!archetype || !positions) continue;
            const targetRow = archetype.rowIdxOf(access.row);
            const target = targets[row];
            const style = world.has(target, CultivatorTag)
                ? DamageDisplayStyle.Taken
                : DamageDisplayStyle.Dealt;
            const hash = damageDisplayHash(
                request,
                target,
                time.tick,
            );
            commands
                .spawn()
                .add(Position3Type)
                .add(DamageDisplayType)
                .set(
                    Position3Type,
                    Float3.X,
                    positions[Float3.X][targetRow],
                )
                .set(
                    Position3Type,
                    Float3.Y,
                    positions[Float3.Y][targetRow] +
                        (style === DamageDisplayStyle.Taken ? 1.55 : 1.15),
                )
                .set(
                    Position3Type,
                    Float3.Z,
                    positions[Float3.Z][targetRow],
                )
                .set(DamageDisplayType, DamageDisplay.Amount, amount)
                .set(
                    DamageDisplayType,
                    DamageDisplay.StartTick,
                    time.tick,
                )
                .set(
                    DamageDisplayType,
                    DamageDisplay.DurationTicks,
                    DAMAGE_DISPLAY_DURATION_TICKS,
                )
                .set(DamageDisplayType, DamageDisplay.Style, style)
                .set(
                    DamageDisplayType,
                    DamageDisplay.HorizontalOffset,
                    ((hash & 1023) / 1023 - 0.5) * 0.75,
                )
                .submit();
        }
    }
}

function expireDamageDisplays(
    time: Readonly<TimeState>,
    commands: Commands,
    displays: Displays,
): void {
    const tick = time.tick;
    const iter = displays.iter();
    while (iter.next()) {
        const [count, entities, , data] = iter.current;
        const startTicks = data[DamageDisplay.StartTick];
        const durations = data[DamageDisplay.DurationTicks];
        for (let row = 0; row < count; row++) {
            if (tick - startTicks[row] < durations[row]) continue;
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

export function damageDisplayHash(
    request: number,
    target: number,
    tick: number,
): number {
    let hash = (
        Math.imul(request, 0x9e3779b1) ^
        Math.imul(target, 0x85ebca6b) ^
        tick
    ) >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d) >>> 0;
    hash ^= hash >>> 15;
    return hash >>> 0;
}

const DAMAGE_DISPLAY_DURATION_TICKS = 42;
