import type { Color32, RenderService } from "./render-service";

/** 基于后端无关图元组合的通用血条，不扩大 RenderService 领域 API。 */
export function drawHealthBar(
    renderer: RenderService,
    centerX: number,
    y: number,
    width: number,
    height: number,
    progress: number,
    background: Color32,
    healthy: Color32,
    warning: Color32,
    danger: Color32,
): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const color = clamped > 0.5 ? healthy : clamped > 0.25 ? warning : danger;
    renderer.fillRect(centerX - width * 0.5, y, width, height, background);
    renderer.fillRect(centerX - width * 0.5, y, width * clamped, height, color);
}
