import { CommandService, TimeState, type Entity, type Readonly } from "zero-ecs-lib";
import { DamageText } from "./components";
import { Position } from "../common/components";
import { GameMode, GameState } from "../common/game-state";
import type { DamageTexts } from "./types";

export function damageTextUpdateSystem(
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: CommandService,
    texts: DamageTexts,
): void {
    if (game.skipTick || game.mode === GameMode.GameOver) return;
    const iter = texts.iter();
    while (iter.next()) {
        const [count, entities, positions, textData] = iter.current;
        const ys = positions[Position.y];
        const lifetimes = textData[DamageText.lifetime];
        const floats = textData[DamageText.floatY];
        for (let i = 0; i < count; i++) {
            lifetimes[i] -= time.delta;
            if (lifetimes[i] <= 0) { commands.entity(entities[i] as Entity).despawn().submit(); continue; }
            ys[i] = floats[i] + (0.7 - lifetimes[i]) * 40;
        }
    }
}
