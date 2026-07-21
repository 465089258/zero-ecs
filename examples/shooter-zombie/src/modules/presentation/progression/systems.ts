import { defSystem, type QueryOf } from "@zero-ecs/game";
import { Float2 } from "../../common";
import { ExpOrb, ExpOrbQuery } from "../../progression";
import { Render, RenderFrameState, RenderService } from "../core";
import { ProgressionRenderConfig } from "./config";

type ExpOrbs = QueryOf<typeof ExpOrbQuery>;

export const drawExpOrbsSystem = defSystem(Render, drawExpOrbs, [
    RenderService, ProgressionRenderConfig, RenderFrameState, ExpOrbQuery,
]);

function drawExpOrbs(
    renderer: RenderService,
    style: Readonly<ProgressionRenderConfig>,
    frame: Readonly<RenderFrameState>,
    orbs: ExpOrbs,
): void {
    const pulse = 1 + Math.sin(frame.now * 0.006) * 0.2;
    const iter = orbs.iter();
    while (iter.next()) {
        const [count, , positions, , data] = iter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        const active = data[ExpOrb.active];
        const radii = data[ExpOrb.radius];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            const x = xs[i];
            const y = ys[i];
            const radius = radii[i] * pulse;
            renderer.fillCircle(x, y, radius + 4, style.auraColor);
            renderer.fillCircle(x, y, radius, style.orbColor, style.glow);
            renderer.fillText("XP", x, y, style.label);
        }
    }
}
