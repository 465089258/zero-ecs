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

export class FeedbackRenderConfig extends Resource {
    readonly valueText = textStyle({
        color: rgb(0xffeb3b),
        size: 12,
        family: RenderFontFamily.Monospace,
        weight: RenderFontWeight.Bold,
        align: RenderTextAlign.Center,
        baseline: RenderTextBaseline.Middle,
    });
    readonly outlineText = textStyle({
        color: rgba(0, 0, 0, 153),
        size: 12,
        family: RenderFontFamily.Monospace,
        weight: RenderFontWeight.Bold,
        align: RenderTextAlign.Center,
        baseline: RenderTextBaseline.Middle,
    });
}
