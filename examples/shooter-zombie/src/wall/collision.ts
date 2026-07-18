import { CommandService, type Entity, type Mut } from "zero-ecs-lib";
import { Wall } from "./components";
import { Position } from "../common/components";
import { Zombie } from "../zombie/components";
import { GameConfig } from "../common/game-config";
import { GameMode, GameState } from "../common/game-state";
import type { Zombies } from "../zombie/types";
import type { Walls } from "./types";

export function zombieWallCollisionSystem(
    config: Readonly<GameConfig>,
    game: Mut<GameState>,
    commands: CommandService,
    zombies: Zombies,
    walls: Walls,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    let wallEntity: Entity | null = null;
    let wallHp = 0; let wallMaxHp = 0;
    const wallIter = walls.iter();
    while (wallIter.next()) {
        const [wCount, wEntities, , wData] = wallIter.current;
        if (wCount > 0) { wallEntity = wEntities[0] as Entity; wallHp = wData[Wall.hp][0]; wallMaxHp = wData[Wall.maxHp][0]; }
    }
    if (wallEntity === null || wallHp <= 0) return;

    let currentHp = wallHp;
    const zIter = zombies.iter();
    while (zIter.next()) {
        const [count, , zPositions, , zData] = zIter.current;
        const zXs = zPositions[Position.x]; const zActive = zData[Zombie.active];
        const zDamages = zData[Zombie.damage];
        for (let i = 0; i < count; i++) {
            if (zActive[i] === 0) continue;
            if (zXs[i] <= config.wallBoundary + 1) { currentHp -= zDamages[i] * (1 / 120); }
        }
    }
    currentHp = Math.min(wallMaxHp, currentHp + 2 / 120);
    const wIter2 = walls.iter();
    while (wIter2.next()) { const [, , , wData] = wIter2.current; wData[Wall.hp][0] = Math.max(0, currentHp); }
    if (currentHp <= 0) { commands.entity(wallEntity).despawn().submit(); game.mode = GameMode.GameOver; }
    game.wallHp = Math.ceil(Math.max(0, currentHp)); game.wallMaxHp = wallMaxHp;
}
