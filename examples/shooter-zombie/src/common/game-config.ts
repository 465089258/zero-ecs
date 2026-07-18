import { Resource } from "zero-ecs-lib";

export class GameConfig extends Resource {
    readonly width = 960;
    readonly height = 640;
    readonly shooterX = 70;
    readonly shooterY = 320;
    readonly zombieSpawnX = 920;
    readonly zombieSpawnYMin = 80;
    readonly zombieSpawnYMax = 560;
    readonly maxBullets = 5000;
    readonly wallBoundary = 236;  // wallX(210) + wallHalfWidth(12) + zombieRadius(14)
    readonly maxZombies = 80;
    readonly maxExpOrbs = 300;
}
