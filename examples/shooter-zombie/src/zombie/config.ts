import { Resource } from "zero-ecs-lib";
export class ZombieConfig extends Resource {
    readonly baseHp = 10; readonly hpGrowth = 15;
    readonly baseSpeed = 20; readonly speedGrowth = 4;
    readonly baseXp = 30; readonly xpGrowth = 5;
    readonly damageBase = 3; readonly radius = 14;
    readonly halfWidth = 12; readonly halfHeight = 16;
}
