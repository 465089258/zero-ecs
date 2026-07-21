import { defSystem, QueryType, With, type QueryOf } from "@zero-ecs/game";
import { Health, HealthType } from "../../attribute";
import { Float2, GameConfigResource, PositionType, VelocityType } from "../../common";
import { Zombie, ZombieType } from "../../zombie";
import { drawHealthBar, Render, RenderService } from "../core";
import { ZombieRenderConfig } from "./config";

export const ZombieRenderQuery = QueryType.from(With(
    PositionType, VelocityType, ZombieType, HealthType,
));
type Zombies = QueryOf<typeof ZombieRenderQuery>;

export const drawZombiesSystem = defSystem(Render, drawZombies, [
    RenderService, ZombieRenderConfig, GameConfigResource, ZombieRenderQuery,
]);

function drawZombies(
    renderer: RenderService,
    style: Readonly<ZombieRenderConfig>,
    game: Readonly<GameConfigResource>,
    zombies: Zombies,
): void {
    const iter = zombies.iter();
    while (iter.next()) {
        const [count, , positions, , data, health] = iter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        const active = data[Zombie.active];
        const currentHealth = health[Health.current];
        const maxHealth = health[Health.max];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            const x = xs[i];
            const y = ys[i];
            const healthRatio = currentHealth[i] / maxHealth[i];
            const bodyColor = healthRatio < 0.3 ? style.damagedColor : style.normalColor;
            renderer.fillRect(
                x - game.zombieHalfWidth,
                y - game.zombieHalfHeight,
                game.zombieHalfWidth * 2,
                game.zombieHalfHeight * 2,
                bodyColor,
                style.glow,
            );
            renderer.fillCircle(x, y - game.zombieHalfHeight - 3, 8, bodyColor);
            renderer.fillRect(x - 4, y - game.zombieHalfHeight - 6, 3, 3, style.eyeColor);
            renderer.fillRect(x + 1, y - game.zombieHalfHeight - 6, 3, 3, style.eyeColor);
            renderer.fillRect(x - 3, y - game.zombieHalfHeight - 5, 2, 2, style.pupilColor);
            renderer.fillRect(x + 2, y - game.zombieHalfHeight - 5, 2, 2, style.pupilColor);
            drawHealthBar(
                renderer,
                x,
                y - game.zombieHalfHeight - 16,
                game.zombieHalfWidth * 2,
                4,
                healthRatio,
                style.barBackground,
                style.healthyColor,
                style.warningColor,
                style.dangerColor,
            );
        }
    }
}
