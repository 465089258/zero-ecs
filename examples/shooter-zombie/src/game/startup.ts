import type { Mut } from "zero-ecs-lib";
import { CommandService } from "zero-ecs-lib";
import { GameState } from "../common/game-state";
import { GameViewResource } from "../common/game-view-resource";
import { GameConfig } from "../common/game-config";
import { RenderState } from "../renderer/render-state";
import { RendererService } from "../renderer/renderer-service";
import { spawnShooter } from "../shooter/spawn";
import { ShooterConfig } from "../shooter/config";
import { ShooterState } from "../shooter/state";
import { spawnWall } from "../wall/spawn";
import { WallConfig } from "../wall/config";

export function startupGameSystem(
    commands: CommandService,
    view: GameViewResource,
    gameCfg: GameConfig,
    game: Mut<GameState>,
    renderState: RenderState,
    renderer: RendererService,
    shooterCfg: ShooterConfig,
    shooterSt: ShooterState,
    wallCfg: WallConfig,
): void {
    // Init canvas
    const ctx = view.context;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    ctx.canvas.width = gameCfg.width * ratio;
    ctx.canvas.height = gameCfg.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    renderState.background = ctx.createLinearGradient(0, 0, gameCfg.width, 0);
    renderState.background.addColorStop(0, "#0b1a0b");
    renderState.background.addColorStop(0.5, "#0f1f0f");
    renderState.background.addColorStop(1, "#081408");

    game.skipTick = 1;
    game.xpToNext = 50;
    spawnShooter(commands, gameCfg, shooterCfg, shooterSt);
    spawnWall(commands, wallCfg);
}
