import type { QueryOf } from "zero-ecs-lib";
import { BulletQuery, DamageTextQuery, ExpOrbQuery, GameEntityQuery, ShooterQuery, WallQuery, ZombieQuery } from "./queries";

export type Shooters = QueryOf<typeof ShooterQuery>;
export type Bullets = QueryOf<typeof BulletQuery>;
export type Zombies = QueryOf<typeof ZombieQuery>;
export type Walls = QueryOf<typeof WallQuery>;
export type ExpOrbs = QueryOf<typeof ExpOrbQuery>;
export type DamageTexts = QueryOf<typeof DamageTextQuery>;
export type GameEntities = QueryOf<typeof GameEntityQuery>;
