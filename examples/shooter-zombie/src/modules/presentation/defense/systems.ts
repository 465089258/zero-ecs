import { defSystem, QueryType, With, type QueryOf } from "@zero-ecs/game";
import { Health, HealthType } from "../../attribute";
import { Float2, GameConfigResource, PositionType } from "../../common";
import { WallType } from "../../zombie";
import { drawHealthBar, Render, RenderService } from "../core";
import { DefenseRenderConfig } from "./config";

export const DefenseRenderQuery = QueryType.from(With(PositionType, WallType, HealthType));
type Walls = QueryOf<typeof DefenseRenderQuery>;

export const drawDefenseSystem = defSystem(Render, drawDefense, [
    RenderService, DefenseRenderConfig, GameConfigResource, DefenseRenderQuery,
]);

function drawDefense(
    renderer: RenderService,
    style: Readonly<DefenseRenderConfig>,
    game: Readonly<GameConfigResource>,
    walls: Walls,
): void {
    const iter = walls.iter();
    while (iter.next()) {
        const [count, , positions, , health] = iter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        const currentHealth = health[Health.current];
        const maxHealth = health[Health.max];
        for (let i = 0; i < count; i++) {
            const x = xs[i];
            const y = ys[i];
            const hp = currentHealth[i];
            const maxHp = maxHealth[i];
            const healthRatio = hp / maxHp;
            const color = healthRatio < 0.3 ? style.damagedColor : style.normalColor;
            const left = x - game.wallHalfWidth;
            const top = y - game.wallHalfHeight;
            renderer.fillRect(left, top, game.wallHalfWidth * 2, game.wallHalfHeight * 2, color);

            const brickHeight = 12;
            for (let row = top; row < y + game.wallHalfHeight; row += brickHeight) {
                renderer.strokeLine(left, row, x + game.wallHalfWidth, row, 1, style.brickLineColor);
                const offset = Math.floor((row - top) / brickHeight) % 2 === 0
                    ? 0
                    : game.wallHalfWidth * 0.5;
                for (let column = left + offset; column < x + game.wallHalfWidth; column += game.wallHalfWidth) {
                    renderer.strokeLine(column, row, column, row + brickHeight, 1, style.brickLineColor);
                }
            }

            if (healthRatio < 0.6) {
                renderer.strokeLine(
                    x - game.wallHalfWidth * 0.7,
                    y - game.wallHalfHeight * 0.8,
                    x - game.wallHalfWidth * 0.2,
                    y,
                    2,
                    style.crackColor,
                );
                renderer.strokeLine(
                    x - game.wallHalfWidth * 0.2,
                    y,
                    x + game.wallHalfWidth * 0.1,
                    y + game.wallHalfHeight * 0.3,
                    2,
                    style.crackColor,
                );
            }
            if (healthRatio < 0.3) {
                renderer.strokeLine(
                    x + game.wallHalfWidth * 0.6,
                    y - game.wallHalfHeight * 0.5,
                    x + game.wallHalfWidth * 0.3,
                    y,
                    2,
                    style.crackColor,
                );
                renderer.strokeLine(
                    x + game.wallHalfWidth * 0.3,
                    y,
                    x - game.wallHalfWidth * 0.1,
                    y + game.wallHalfHeight * 0.5,
                    2,
                    style.crackColor,
                );
            }

            const barY = top - 12;
            drawHealthBar(
                renderer,
                x,
                barY,
                game.wallHalfWidth * 2,
                6,
                healthRatio,
                style.barBackground,
                style.healthyColor,
                style.warningColor,
                style.dangerColor,
            );
            renderer.fillText(`Wall ${Math.ceil(hp)}/${maxHp}`, x, barY - 2, style.label);
        }
    }
}
