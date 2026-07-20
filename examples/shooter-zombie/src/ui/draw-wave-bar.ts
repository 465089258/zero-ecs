import { RenderState } from "../renderer/render-state";
import { RendererService } from "../renderer/renderer-service";
import { WavePhase } from "../common/game-state";
import { WaveState } from "../zombie/wave-state";

export function drawWaveBarSystem(state: RenderState, wave: WaveState): void {
    const ctx = state.view.context;
    if (wave.wave === 0) return;
    const barX = 16, barY = 10, barW = state.config.width - 32, barH = 18;
    let progress = 0;
    if (wave.wavePhase === WavePhase.Spawning) progress = 0.3;
    else if (wave.wavePhase === WavePhase.Fighting) progress = 0.6;
    else if (wave.wavePhase === WavePhase.Horde) progress = 0.8;
    else progress = 1.0;

    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = wave.wavePhase === WavePhase.Horde ? "#ef5350" : "#66bb6a";
    ctx.fillRect(barX, barY, barW * progress, barH);
    ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, barH);

    const phaseLabel = wave.wavePhase === WavePhase.Horde ? `尸潮! ${state.game.zombies}只`
        : wave.wavePhase === WavePhase.Resting ? "休息中..."
        : wave.wavePhase === WavePhase.Fighting ? "战斗中" : "生成中";
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`WAVE ${wave.wave} · ${phaseLabel}`, barX + barW / 2, barY + barH / 2);
}
