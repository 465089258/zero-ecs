import { Resource } from "@zero-ecs/game";
import {
    RenderFontFamily,
    RenderFontWeight,
    RenderTextAlign,
    RenderTextBaseline,
    rgb,
    rgba,
    textStyle,
} from "../core";

export class DefenseRenderConfig extends Resource {
    readonly normalColor = rgb(0x90a4ae);
    readonly damagedColor = rgb(0xff8a65);
    readonly brickLineColor = rgba(0, 0, 0, 77);
    readonly crackColor = rgba(0, 0, 0, 128);
    readonly barBackground = rgba(0, 0, 0, 128);
    readonly healthyColor = rgb(0x66bb6a);
    readonly warningColor = rgb(0xffa726);
    readonly dangerColor = rgb(0xef5350);
    readonly label = textStyle({
        color: rgb(0xffffff),
        size: 9,
        family: RenderFontFamily.Monospace,
        weight: RenderFontWeight.Normal,
        align: RenderTextAlign.Center,
        baseline: RenderTextBaseline.Bottom,
    });
}
