import { Resource } from "@zero-ecs/game";
import {
    RenderFontFamily,
    RenderFontWeight,
    RenderTextAlign,
    RenderTextBaseline,
    rgb,
    textStyle,
} from "../core";

export class ShooterRenderConfig extends Resource {
    readonly bodyColor = rgb(0x4fc3f7);
    readonly bowColor = rgb(0xffffff);
    readonly glow = 12;
    readonly levelText = textStyle({
        color: rgb(0xffffff),
        size: 10,
        family: RenderFontFamily.Monospace,
        weight: RenderFontWeight.Bold,
        align: RenderTextAlign.Center,
        baseline: RenderTextBaseline.Top,
    });
}
