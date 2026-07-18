import type { Mut } from "zero-ecs-lib";
import { Bullet } from "../bullet/components";
import { Zombie } from "../zombie/components";
import { ExpOrb } from "../exp-orb/components";
import { GameState } from "../common/game-state";
import { WallConfig } from "../wall/config";
import type { Bullets } from "../bullet/types";
import type { Zombies } from "../zombie/types";
import type { ExpOrbs } from "../exp-orb/types";
import { GameEntityQuery } from "./query";
import type { QueryOf } from "zero-ecs-lib";

type GameEntities = QueryOf<typeof GameEntityQuery>;

export function statisticsSystem(
    game: Mut<GameState>, wallCfg: Readonly<WallConfig>,
    bullets: Bullets, zombies: Zombies, expOrbs: ExpOrbs, entities: GameEntities,
): void {
    game.bullets = countActiveBullets(bullets);
    game.zombies = countActiveZombies(zombies);
    game.expOrbs = countActiveExpOrbs(expOrbs);
    game.entities = countEntities(entities);
    if (game.wallMaxHp === 0) game.wallMaxHp = wallCfg.initialHp;
    game.skipTick = 0;
}

function countActiveBullets(query: Bullets): number { let t = 0; const iter = query.iter(); while (iter.next()) { const [c, , , , b] = iter.current; for (let i = 0; i < c; i++) t += b[Bullet.active][i] !== 0 ? 1 : 0; } return t; }
function countActiveZombies(query: Zombies): number { let t = 0; const iter = query.iter(); while (iter.next()) { const [c, , , , z] = iter.current; for (let i = 0; i < c; i++) t += z[Zombie.active][i] !== 0 ? 1 : 0; } return t; }
function countActiveExpOrbs(query: ExpOrbs): number { let t = 0; const iter = query.iter(); while (iter.next()) { const [c, , , , o] = iter.current; for (let i = 0; i < c; i++) t += o[ExpOrb.active][i] !== 0 ? 1 : 0; } return t; }
function countEntities(query: GameEntities): number { let t = 0; const iter = query.iter(); while (iter.next()) t += iter.current[0]; return t; }
