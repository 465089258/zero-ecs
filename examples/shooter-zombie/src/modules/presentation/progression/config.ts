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

export class ProgressionRenderConfig extends Resource {
    readonly orbColor = rgb(0xba68c8);
    readonly auraColor = rgba(186, 104, 200, 51);
    readonly glow = 8;
    readonly label = textStyle({
        color: rgb(0xffffff),
        size: 7,
        family: RenderFontFamily.Monospace,
        weight: RenderFontWeight.Bold,
        align: RenderTextAlign.Center,
        baseline: RenderTextBaseline.Middle,
    });
}
