import {
    defSystem,
    RandomService,
    Update,
    Write,
    type Mut,
} from "@zero-ecs/game";
import { GameMode, GameSessionState } from "../common";
import { InputService } from "../host";
import { applyUpgrade, pickUpgrades, ProgressionState } from "../progression";

/** Host/Progression → Session：集成层解释输入，但成长模块本身不依赖 DOM 输入。 */
export const progressionInputSystem = defSystem(Update.fixed, processProgressionInput, [
    InputService, RandomService, Write(GameSessionState), Write(ProgressionState),
]);

function processProgressionInput(
    input: InputService,
    random: RandomService,
    session: Mut<GameSessionState>,
    progression: Mut<ProgressionState>,
): void {
    if (session.skipTick) return;
    if (session.mode === GameMode.LevelUp) {
        const choice = input.consumeUpgrade();
        if (choice < 0 || choice >= progression.upgradeOptions.length) return;
        applyUpgrade(progression, progression.upgradeOptions[choice]);
        progression.rebuildShooter = 1;
        progression.upgradeOptions = [];
        session.mode = GameMode.Playing;
        session.skipTick = 1;
        return;
    }
    if (session.mode !== GameMode.Playing || progression.xp < progression.xpToNext) return;

    progression.xp -= progression.xpToNext;
    progression.level++;
    progression.xpToNext = Math.floor(
        50 + progression.level * 45 + progression.level * progression.level * 5,
    );
    progression.upgradeOptions = pickUpgrades(random, 3);
    session.mode = GameMode.LevelUp;
}
