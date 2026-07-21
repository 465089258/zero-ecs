import { defSystem } from "@zero-ecs/game";
import { GameConfigResource } from "../../common";
import { GroundRenderConfig } from "./config";
import { Render, RenderService } from "../core";

export const drawGroundSystem = defSystem(Render, drawGround, [
    RenderService, GroundRenderConfig, GameConfigResource,
]);

function drawGround(
    renderer: RenderService,
    style: Readonly<GroundRenderConfig>,
    game: Readonly<GameConfigResource>,
): void {
    renderer.fillLinearGradientRect(0, 0, game.width, game.height, style.background);
    for (let x = 0; x <= game.width; x += style.gridSize) {
        renderer.strokeLine(x, 0, x, game.height, 1, style.gridColor);
    }
    for (let y = 0; y <= game.height; y += style.gridSize) {
        renderer.strokeLine(0, y, game.width, y, 1, style.gridColor);
    }
}
