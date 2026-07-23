import { Inject } from "@zero-ecs/game";
import { GameViewResource } from "../../host";
import { HudMetric, HudService } from "./hud-service";

/** HudService 的浏览器 DOM 实现。 */
export class DomHudService extends HudService {
    @Inject.resource(GameViewResource) private readonly view!: GameViewResource;

    setMetric(metric: HudMetric, value: string): void {
        const telemetry = this.view.telemetry;
        switch (metric) {
            case HudMetric.Fps: telemetry.fps.textContent = value; break;
            case HudMetric.SimulationMs: telemetry.simMs.textContent = value; break;
            case HudMetric.RenderMs: telemetry.renderMs.textContent = value; break;
            case HudMetric.Entities: telemetry.entities.textContent = value; break;
            case HudMetric.Bullets: telemetry.bullets.textContent = value; break;
            case HudMetric.Zombies: telemetry.zombies.textContent = value; break;
            case HudMetric.Score: telemetry.score.textContent = value; break;
            case HudMetric.Wave: telemetry.wave.textContent = value; break;
            case HudMetric.Level: telemetry.level.textContent = value; break;
            case HudMetric.Experience: telemetry.xp.textContent = value; break;
            case HudMetric.WallHealth: telemetry.wallHp.textContent = value; break;
        }
    }

    showUpgradePanel(visible: boolean): void {
        this.view.upgradeContainer.hidden = !visible;
    }

    setUpgrade(index: number, name: string, description: string): void {
        const slot = this.view.upgradeSlots[index];
        if (!slot) return;
        slot.innerHTML = `
            <span class="key-hint">${index + 1}</span>
            <span class="upgrade-name">${name}</span>
            <span class="upgrade-desc">${description}</span>
        `;
    }

    showMessage(visible: boolean, title: string, copy: string): void {
        const telemetry = this.view.telemetry;
        telemetry.message.hidden = !visible;
        if (!visible) return;
        telemetry.messageTitle.textContent = title;
        telemetry.messageCopy.textContent = copy;
    }
}
