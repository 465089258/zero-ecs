import { RenderState } from "../renderer/render-state";
import { GameMode, UPGRADE_NAMES, UPGRADE_DESCRIPTIONS, UpgradeType } from "../common/game-state";

export function drawTelemetrySystem(state: RenderState): void {
    const ui = state.view.telemetry;
    ui.fps.textContent = state.metrics.fps.toFixed(0);
    ui.simMs.textContent = state.metrics.simulationMs.toFixed(2);
    ui.renderMs.textContent = state.metrics.renderMs.toFixed(2);
    ui.entities.textContent = state.game.entities.toLocaleString();
    ui.bullets.textContent = state.game.bullets.toLocaleString();
    ui.zombies.textContent = state.game.zombies.toLocaleString();
    ui.score.textContent = state.game.score.toString().padStart(6, "0");
    ui.wave.textContent = "?"; // wave state
    ui.level.textContent = state.game.level.toString();
    ui.xp.textContent = `${state.game.xp}/${state.game.xpToNext}`;
    ui.wallHp.textContent = `${Math.ceil(state.game.wallHp)}/${state.game.wallMaxHp}`;

    const isLevelUp = state.game.mode === GameMode.LevelUp;
    state.view.upgradeContainer.hidden = !isLevelUp;
    if (isLevelUp && state.game.upgradeOptions.length === 3) {
        for (let i = 0; i < 3; i++) {
            const up = state.game.upgradeOptions[i] as UpgradeType;
            state.view.upgradeSlots[i].innerHTML = `<span class="key-hint">${i + 1}</span><span class="upgrade-name">${UPGRADE_NAMES[up] ?? "?"}</span><span class="upgrade-desc">${UPGRADE_DESCRIPTIONS[up]?.(1) ?? ""}</span>`;
        }
    }
    const halted = state.game.mode !== GameMode.Playing;
    ui.message.hidden = !halted;
    if (!halted) return;
    if (state.game.mode === GameMode.GameOver) { ui.messageTitle.textContent = "DEFEAT"; ui.messageCopy.textContent = `得分 ${state.game.score.toLocaleString()} · 按 R 重新开始`; }
    else { ui.messageTitle.textContent = "LEVEL UP!"; ui.messageCopy.textContent = "按 1/2/3 选择升级"; }
}
