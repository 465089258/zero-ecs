import { Commands, defSystem, Update, type QueryOf } from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import { Float2, GameMode, GameSessionState } from "../common";
import { DamageText } from "./components";
import { DamageTextQuery } from "./queries";

type DamageTexts = QueryOf<typeof DamageTextQuery>;

export const damageTextUpdateSystem = defSystem(Update.fixed, updateDamageTexts, [
    TimeState, GameSessionState, Commands, DamageTextQuery,
]);

function updateDamageTexts(
    time: Readonly<TimeState>,
    session: Readonly<GameSessionState>,
    commands: Commands,
    texts: DamageTexts,
): void {
    if (session.skipTick || session.mode === GameMode.GameOver) return;
    const iter = texts.iter();
    while (iter.next()) {
        const [count, entities, positions, data] = iter.current;
        const ys = positions[Float2.y];
        const lifetimes = data[DamageText.lifetime];
        const origins = data[DamageText.floatY];
        for (let i = 0; i < count; i++) {
            lifetimes[i] -= time.delta;
            if (lifetimes[i] <= 0) commands.entity(entities[i]).despawn().submit();
            else ys[i] = origins[i] + (0.7 - lifetimes[i]) * 40;
        }
    }
}
