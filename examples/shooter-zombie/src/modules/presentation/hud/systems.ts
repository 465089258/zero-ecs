import { defSystem, Write, type Mut } from "@zero-ecs/game";
import { GameConfigResource, GameMode, GameSessionState } from "../../common";
import { MetricsService } from "../../host";
import { GameplayStatisticsState, WaveState } from "../../integration";
import {
    ProgressionState,
    UPGRADE_DESCRIPTIONS,
    UPGRADE_NAMES,
    UpgradeType,
} from "../../progression";
import { Render, RenderFrameState, RenderService } from "../core";
import { HudRenderConfig } from "./config";
import { HudMetric, HudService } from "./hud-service";
import { HudRenderState } from "./state";

export const drawWaveHudSystem = defSystem(Render, drawWaveHud, [
    RenderService, HudRenderConfig, GameConfigResource, WaveState, GameplayStatisticsState,
]);

export const updateDomHudSystem = defSystem(Render, updateDomHud, [
    HudService, HudRenderConfig, RenderFrameState, Write(HudRenderState), MetricsService,
    GameSessionState, ProgressionState, WaveState, GameplayStatisticsState,
]);

function drawWaveHud(
    renderer: RenderService,
    style: Readonly<HudRenderConfig>,
    game: Readonly<GameConfigResource>,
    wave: Readonly<WaveState>,
    statistics: Readonly<GameplayStatisticsState>,
): void {
    if (wave.wave === 0) return;
    const x = 16;
    const y = 10;
    const width = game.width - 32;
    const height = 18;
    const progress = wave.inHorde
        ? wave.waveZombieTotal > 0
            ? Math.min(1, (wave.waveZombieTotal - statistics.zombies) / wave.waveZombieTotal)
            : 0
        : wave.waveDuration > 0
            ? Math.min(1, 1 - wave.waveTimer / wave.waveDuration)
            : 0;
    renderer.fillRect(x, y, width, height, style.barBackground);
    renderer.fillRect(
        x,
        y,
        width * progress,
        height,
        wave.inHorde ? style.hordeProgress : style.normalProgress,
    );
    renderer.strokeRect(x, y, width, height, 1, style.border);
    const label = wave.inHorde
        ? `WAVE ${wave.wave} · 尸潮! ${statistics.zombies}只`
        : `WAVE ${wave.wave} · ${wave.waveTimer.toFixed(1)}s`;
    renderer.fillText(label, x + width * 0.5, y + height * 0.5, style.waveText);
}

function updateDomHud(
    hud: HudService,
    style: Readonly<HudRenderConfig>,
    frame: Readonly<RenderFrameState>,
    renderState: Mut<HudRenderState>,
    metrics: MetricsService,
    session: Readonly<GameSessionState>,
    progression: Readonly<ProgressionState>,
    wave: Readonly<WaveState>,
    statistics: Readonly<GameplayStatisticsState>,
): void {
    if (frame.now < renderState.nextTelemetryAt) return;
    renderState.nextTelemetryAt = frame.now + style.telemetryInterval;
    hud.setMetric(HudMetric.Fps, metrics.fps.toFixed(0));
    hud.setMetric(HudMetric.SimulationMs, metrics.simulationMs.toFixed(2));
    hud.setMetric(HudMetric.RenderMs, metrics.renderMs.toFixed(2));
    hud.setMetric(HudMetric.Entities, statistics.entities.toLocaleString());
    hud.setMetric(HudMetric.Bullets, statistics.bullets.toLocaleString());
    hud.setMetric(HudMetric.Zombies, statistics.zombies.toLocaleString());
    hud.setMetric(HudMetric.Score, statistics.score.toString().padStart(6, "0"));
    hud.setMetric(HudMetric.Wave, wave.wave.toString());
    hud.setMetric(HudMetric.Level, progression.level.toString());
    hud.setMetric(HudMetric.Experience, `${progression.xp}/${progression.xpToNext}`);
    hud.setMetric(
        HudMetric.WallHealth,
        `${Math.ceil(statistics.wallHp)}/${statistics.wallMaxHp}`,
    );

    const selectingUpgrade = session.mode === GameMode.LevelUp;
    hud.showUpgradePanel(selectingUpgrade);
    if (selectingUpgrade && progression.upgradeOptions.length === 3) {
        for (let i = 0; i < 3; i++) {
            const upgrade = progression.upgradeOptions[i] as UpgradeType;
            hud.setUpgrade(
                i,
                UPGRADE_NAMES[upgrade] ?? "?",
                UPGRADE_DESCRIPTIONS[upgrade]?.(upgradeLevel(progression, upgrade)) ?? "",
            );
        }
    }

    if (session.mode === GameMode.GameOver) {
        hud.showMessage(
            true,
            "DEFEAT",
            `得分 ${statistics.score.toLocaleString()} · Wave ${wave.wave} · 按 R 重新开始`,
        );
    } else if (selectingUpgrade) {
        hud.showMessage(true, "LEVEL UP!", "按 1/2/3 选择升级");
    } else {
        hud.showMessage(false, "", "");
    }
}

function upgradeLevel(progression: Readonly<ProgressionState>, upgrade: UpgradeType): number {
    switch (upgrade) {
        case UpgradeType.Damage: return progression.damageLevel;
        case UpgradeType.AttackSpeed: return progression.attackSpeedLevel;
        case UpgradeType.Scatter: return progression.scatterLevel;
        case UpgradeType.Split: return progression.splitLevel;
        case UpgradeType.Ricochet: return progression.ricochetLevel;
        case UpgradeType.Burst: return progression.burstLevel;
        case UpgradeType.CritChance: return progression.critChanceLevel;
        case UpgradeType.CritDamage: return progression.critDamageLevel;
        case UpgradeType.FlatDamage: return progression.flatDamageLevel;
        case UpgradeType.DamageMultiplier: return progression.damageMultiplierLevel;
    }
}
