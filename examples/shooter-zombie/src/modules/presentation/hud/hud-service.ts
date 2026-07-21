import { Service } from "@zero-ecs/game";

export const enum HudMetric {
    Fps,
    SimulationMs,
    RenderMs,
    Entities,
    Bullets,
    Zombies,
    Score,
    Wave,
    Level,
    Experience,
    WallHealth,
}

/** 后端无关的游戏 HUD 输出能力。 */
export abstract class HudService extends Service {
    abstract setMetric(metric: HudMetric, value: string): void;
    abstract showUpgradePanel(visible: boolean): void;
    abstract setUpgrade(index: number, name: string, description: string): void;
    abstract showMessage(visible: boolean, title: string, copy: string): void;
}
