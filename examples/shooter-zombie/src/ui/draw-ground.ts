import { RenderState } from "../renderer/render-state";
import { RendererService } from "../renderer/renderer-service";

const GRID_COLOR = "rgba(50, 90, 50, 0.15)";

export function drawGroundSystem(state: RenderState, renderer: RendererService): void {
    const ctx = state.view.context;
    const w = state.config.width, h = state.config.height;
    ctx.fillStyle = state.background ?? "#0b1a0b";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = GRID_COLOR; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= w; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y <= h; y += 48) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
}
