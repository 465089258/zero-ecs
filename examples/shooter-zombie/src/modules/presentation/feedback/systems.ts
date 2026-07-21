import { defSystem, type QueryOf } from "@zero-ecs/game";
import { Float2 } from "../../common";
import { DamageText, DamageTextQuery } from "../../feedback";
import { Render, RenderService } from "../core";
import { FeedbackRenderConfig } from "./config";

type DamageTexts = QueryOf<typeof DamageTextQuery>;

export const drawDamageTextsSystem = defSystem(Render, drawDamageTexts, [
    RenderService, FeedbackRenderConfig, DamageTextQuery,
]);

function drawDamageTexts(
    renderer: RenderService,
    style: Readonly<FeedbackRenderConfig>,
    damageTexts: DamageTexts,
): void {
    const iter = damageTexts.iter();
    while (iter.next()) {
        const [count, , positions, data] = iter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        const values = data[DamageText.value];
        const lifetimes = data[DamageText.lifetime];
        for (let i = 0; i < count; i++) {
            const opacity = Math.min(1, lifetimes[i] / 0.3);
            const text = Math.round(values[i]).toString();
            renderer.strokeText(text, xs[i], ys[i], 2, style.outlineText, opacity);
            renderer.fillText(text, xs[i], ys[i], style.valueText, opacity);
        }
    }
}
