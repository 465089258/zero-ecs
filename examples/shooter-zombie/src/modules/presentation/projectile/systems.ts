import { defSystem, type QueryOf } from "@zero-ecs/game";
import { Float2 } from "../../common";
import { Bullet, BulletQuery } from "../../projectile";
import { Render, RenderService } from "../core";
import { ProjectileRenderConfig } from "./config";

type Bullets = QueryOf<typeof BulletQuery>;

export const drawProjectilesSystem = defSystem(Render, drawProjectiles, [
    RenderService, ProjectileRenderConfig, BulletQuery,
]);

function drawProjectiles(
    renderer: RenderService,
    style: Readonly<ProjectileRenderConfig>,
    bullets: Bullets,
): void {
    const iter = bullets.iter();
    while (iter.next()) {
        const [count, , positions, , data] = iter.current;
        const xs = positions[Float2.x];
        const ys = positions[Float2.y];
        const active = data[Bullet.active];
        const radii = data[Bullet.radius];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            renderer.fillCircle(xs[i], ys[i], radii[i], style.color, style.glow);
        }
    }
}
