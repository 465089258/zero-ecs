import { Service } from "zero-ecs-lib";

// HP bar colors
const HP_HIGH = "#66bb6a";   // > 50%
const HP_MID  = "#ffa726";   // 25-50%
const HP_LOW  = "#ef5350";   // < 25%

export class RendererService extends Service {
    rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, shadowBlur = 0): void {
        if (shadowBlur > 0) { ctx.shadowColor = color; ctx.shadowBlur = shadowBlur; }
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        if (shadowBlur > 0) ctx.shadowBlur = 0;
    }

    circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, shadowBlur = 0): void {
        if (shadowBlur > 0) { ctx.shadowColor = color; ctx.shadowBlur = shadowBlur; }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (shadowBlur > 0) ctx.shadowBlur = 0;
    }

    arc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, start: number, end: number, color: string, lineWidth = 1): void {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.arc(x, y, r, start, end);
        ctx.stroke();
    }

    text(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, font: string, color: string, align: CanvasTextAlign = "center", baseline: CanvasTextBaseline = "middle"): void {
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        ctx.fillText(text, x, y);
    }

    strokeText(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, font: string, color: string, lineWidth: number, align: CanvasTextAlign = "center", baseline: CanvasTextBaseline = "middle"): void {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.font = font;
        ctx.textAlign = align;
        ctx.textBaseline = baseline;
        ctx.strokeText(text, x, y);
    }

    hpBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, health: number): void {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = health > 0.5 ? HP_HIGH : health > 0.25 ? HP_MID : HP_LOW;
        ctx.fillRect(x, y, w * health, h);
    }

    line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1): void {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
}
