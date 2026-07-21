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

export class HudRenderConfig extends Resource {
    readonly barBackground = rgba(0, 0, 0, 128);
    readonly normalProgress = rgb(0x66bb6a);
    readonly hordeProgress = rgb(0xef5350);
    readonly border = rgba(255, 255, 255, 77);
    readonly waveText = textStyle({
        color: rgb(0xffffff),
        size: 11,
        family: RenderFontFamily.Monospace,
        weight: RenderFontWeight.Bold,
        align: RenderTextAlign.Center,
        baseline: RenderTextBaseline.Middle,
    });
    readonly telemetryInterval = 100;
}
