import { Resource } from "zero-ecs-lib";
export class WaveConfig extends Resource {
    readonly spawnDelayMin = 1.5; readonly spawnDelayMax = 4.0;
    readonly bossWaveInterval = 5; readonly bossWaveMultiplier = 1.5;
    readonly baseZombieGrowth = 2; readonly zombiePerWaveGrowth = 2;
    readonly restTime = 3.0;
}
