import { Service } from "@zero-ecs/game";

declare const Color32Brand: unique symbol;

/** 后端无关的 RRGGBBAA 颜色编码。 */
export type Color32 = number & { readonly [Color32Brand]: "Color32" };

export function rgb(hex: number): Color32 {
    return ((hex << 8) | 0xff) >>> 0 as Color32;
}

export function rgba(red: number, green: number, blue: number, alpha: number): Color32 {
    return (
        ((red & 0xff) << 24)
        | ((green & 0xff) << 16)
        | ((blue & 0xff) << 8)
        | (alpha & 0xff)
    ) >>> 0 as Color32;
}

export const enum RenderTextAlign {
    Left,
    Center,
    Right,
}

export const enum RenderTextBaseline {
    Top,
    Middle,
    Bottom,
}

export const enum RenderFontWeight {
    Normal,
    Bold,
}

export const enum RenderFontFamily {
    Monospace,
    SansSerif,
}

export interface RenderTextStyle {
    readonly color: Color32;
    readonly size: number;
    readonly family: RenderFontFamily;
    readonly weight: RenderFontWeight;
    readonly align: RenderTextAlign;
    readonly baseline: RenderTextBaseline;
}

export interface LinearGradientStyle {
    readonly start: Color32;
    readonly middle: Color32;
    readonly end: Color32;
}

export function textStyle(style: RenderTextStyle): Readonly<RenderTextStyle> {
    return Object.freeze(style);
}

export function linearGradient(style: LinearGradientStyle): Readonly<LinearGradientStyle> {
    return Object.freeze(style);
}

/**
 * 后端无关的即时绘制接口。Canvas 可立即执行，批渲染后端可写入预分配命令缓冲。
 * API 使用位置参数，避免逐实体创建命令对象。
 */
export abstract class RenderService extends Service {
    abstract beginFrame(): void;
    abstract finishFrame(): void;

    abstract fillRect(
        x: number,
        y: number,
        width: number,
        height: number,
        color: Color32,
        glow?: number,
    ): void;

    abstract fillLinearGradientRect(
        x: number,
        y: number,
        width: number,
        height: number,
        style: Readonly<LinearGradientStyle>,
    ): void;

    abstract strokeRect(
        x: number,
        y: number,
        width: number,
        height: number,
        lineWidth: number,
        color: Color32,
    ): void;

    abstract fillCircle(
        x: number,
        y: number,
        radius: number,
        color: Color32,
        glow?: number,
    ): void;

    abstract strokeArc(
        x: number,
        y: number,
        radius: number,
        startAngle: number,
        endAngle: number,
        lineWidth: number,
        color: Color32,
    ): void;

    abstract strokeLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        lineWidth: number,
        color: Color32,
    ): void;

    abstract fillText(
        text: string,
        x: number,
        y: number,
        style: Readonly<RenderTextStyle>,
        opacity?: number,
    ): void;

    abstract strokeText(
        text: string,
        x: number,
        y: number,
        lineWidth: number,
        style: Readonly<RenderTextStyle>,
        opacity?: number,
    ): void;
}
