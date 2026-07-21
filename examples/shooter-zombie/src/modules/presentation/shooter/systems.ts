import { defSystem, type QueryOf } from "@zero-ecs/game";
import { Float2 } from "../../common";
import { ProgressionState } from "../../progression";
import { ShooterQuery } from "../../shooter";
import { Render, RenderService } from "../core";
import { ShooterRenderConfig } from "./config";

type Shooters = QueryOf<typeof ShooterQuery>;

export const drawShootersSystem = defSystem(Render, drawShooters, [
    RenderService, ShooterRenderConfig, ProgressionState, ShooterQuery,
]);

function drawShooters(
    renderer: RenderService,
    style: Readonly<ShooterRenderConfig>,
    progression: Readonly<ProgressionState>,
    shooters: Shooters,
): void {
    const iter = shooters.iter();
    while (iter.next()) {
        const [count, , positions] = iter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        for (let i = 0; i < count; i++) {
            const x = xs[i];
            const y = ys[i];
            renderer.fillRect(x - 8, y - 14, 16, 28, style.bodyColor, style.glow);
            renderer.fillCircle(x, y - 20, 9, style.bodyColor, style.glow);
            renderer.strokeArc(
                x + 10, y, 14, -Math.PI * 0.45, Math.PI * 0.45, 2, style.bowColor,
            );
            renderer.strokeLine(x + 10, y - 10, x + 24, y, 2, style.bowColor);
            renderer.strokeLine(x + 24, y, x + 10, y + 10, 2, style.bowColor);
            renderer.fillText(`Lv.${progression.level}`, x, y + 20, style.levelText);
        }
    }
}
