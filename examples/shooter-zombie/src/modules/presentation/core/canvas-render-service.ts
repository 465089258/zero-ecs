import { Inject } from "@zero-ecs/game";
import { GameConfigResource } from "../../common";
import { GameViewResource } from "../../host";
import {
    type Color32,
    type LinearGradientStyle,
    RenderFontFamily,
    RenderFontWeight,
    RenderService,
    RenderTextAlign,
    RenderTextBaseline,
    type RenderTextStyle,
} from "./render-service";

const TEXT_ALIGNS: readonly CanvasTextAlign[] = ["left", "center", "right"];
const TEXT_BASELINES: readonly CanvasTextBaseline[] = ["top", "middle", "bottom"];
const FONT_FAMILIES = ["monospace", "sans-serif"] as const;

/** RenderService 的 Canvas 2D 后端；领域渲染系统不会直接接触本类型。 */
export class CanvasRenderService extends RenderService {
    @Inject.resource(GameViewResource) private readonly view!: GameViewResource;
    @Inject.resource(GameConfigResource) private readonly config!: GameConfigResource;

    private readonly colorStyles = new Map<Color32, string>();
    private readonly gradientStyles = new WeakMap<Readonly<LinearGradientStyle>, CanvasGradient>();
    private readonly fonts = new WeakMap<Readonly<RenderTextStyle>, string>();
    private fillColor: Color32 | undefined;
    private strokeColor: Color32 | undefined;

    init(): void {
        const { canvas, context } = this.view;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = this.config.width * ratio;
        canvas.height = this.config.height * ratio;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    beginFrame(): void {
        const context = this.view.context;
        context.globalAlpha = 1;
        context.shadowBlur = 0;
        context.lineWidth = 1;
        this.fillColor = undefined;
        this.strokeColor = undefined;
    }

    finishFrame(): void {
        const context = this.view.context;
        context.globalAlpha = 1;
        context.shadowBlur = 0;
        context.lineWidth = 1;
    }

    fillRect(
        x: number,
        y: number,
        width: number,
        height: number,
        color: Color32,
        glow = 0,
    ): void {
        const context = this.view.context;
        this.setFillColor(color);
        this.setGlow(color, glow);
        context.fillRect(x, y, width, height);
        if (glow > 0) context.shadowBlur = 0;
    }

    fillLinearGradientRect(
        x: number,
        y: number,
        width: number,
        height: number,
        style: Readonly<LinearGradientStyle>,
    ): void {
        const context = this.view.context;
        let gradient = this.gradientStyles.get(style);
        if (!gradient) {
            gradient = context.createLinearGradient(x, y, x + width, y);
            gradient.addColorStop(0, this.cssColor(style.start));
            gradient.addColorStop(0.5, this.cssColor(style.middle));
            gradient.addColorStop(1, this.cssColor(style.end));
            this.gradientStyles.set(style, gradient);
        }
        context.fillStyle = gradient;
        this.fillColor = undefined;
        context.fillRect(x, y, width, height);
    }

    strokeRect(
        x: number,
        y: number,
        width: number,
        height: number,
        lineWidth: number,
        color: Color32,
    ): void {
        const context = this.view.context;
        this.setStrokeColor(color);
        context.lineWidth = lineWidth;
        context.strokeRect(x, y, width, height);
    }

    fillCircle(x: number, y: number, radius: number, color: Color32, glow = 0): void {
        const context = this.view.context;
        this.setFillColor(color);
        this.setGlow(color, glow);
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        if (glow > 0) context.shadowBlur = 0;
    }

    strokeArc(
        x: number,
        y: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        lineWidth: number,
        color: Color32,
    ): void {
        const context = this.view.context;
        this.setStrokeColor(color);
        context.lineWidth = lineWidth;
        context.beginPath();
        context.arc(x, y, radius, startAngle, endAngle);
        context.stroke();
    }

    strokeLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        lineWidth: number,
        color: Color32,
    ): void {
        const context = this.view.context;
        this.setStrokeColor(color);
        context.lineWidth = lineWidth;
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
    }

    fillText(
        text: string,
        x: number,
        y: number,
        style: Readonly<RenderTextStyle>,
        opacity = 1,
    ): void {
        const context = this.view.context;
        this.setTextStyle(style);
        this.setFillColor(style.color);
        context.globalAlpha = opacity;
        context.fillText(text, x, y);
        context.globalAlpha = 1;
    }

    strokeText(
        text: string,
        x: number,
        y: number,
        lineWidth: number,
        style: Readonly<RenderTextStyle>,
        opacity = 1,
    ): void {
        const context = this.view.context;
        this.setTextStyle(style);
        this.setStrokeColor(style.color);
        context.lineWidth = lineWidth;
        context.globalAlpha = opacity;
        context.strokeText(text, x, y);
        context.globalAlpha = 1;
    }

    dispose(): void {
        this.colorStyles.clear();
    }

    private setFillColor(color: Color32): void {
        if (this.fillColor === color) return;
        this.view.context.fillStyle = this.cssColor(color);
        this.fillColor = color;
    }

    private setStrokeColor(color: Color32): void {
        if (this.strokeColor === color) return;
        this.view.context.strokeStyle = this.cssColor(color);
        this.strokeColor = color;
    }

    private setGlow(color: Color32, blur: number): void {
        const context = this.view.context;
        context.shadowBlur = blur;
        if (blur > 0) context.shadowColor = this.cssColor(color);
    }

    private setTextStyle(style: Readonly<RenderTextStyle>): void {
        const context = this.view.context;
        let font = this.fonts.get(style);
        if (!font) {
            const weight = style.weight === RenderFontWeight.Bold ? "bold " : "";
            font = `${weight}${style.size}px ${FONT_FAMILIES[style.family]}`;
            this.fonts.set(style, font);
        }
        context.font = font;
        context.textAlign = TEXT_ALIGNS[style.align];
        context.textBaseline = TEXT_BASELINES[style.baseline];
    }

    private cssColor(color: Color32): string {
        let value = this.colorStyles.get(color);
        if (value !== undefined) return value;
        const red = color >>> 24;
        const green = color >>> 16 & 0xff;
        const blue = color >>> 8 & 0xff;
        const alpha = (color & 0xff) / 255;
        value = `rgba(${red},${green},${blue},${alpha})`;
        this.colorStyles.set(color, value);
        return value;
    }
}
