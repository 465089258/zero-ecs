import { State } from "@zero-ecs/game";

/** GameplayIntegration 独占的波次编排状态。 */
export class WaveState extends State {
    wave = 0;
    waveTimer = 0;
    spawnQueue = 0;
    spawnTimer = 0;
    baseZombieCount = 1;
    pendingBaseGrowth = false;
    inHorde = false;
    waveZombieTotal = 0;
    waveDuration = 8;
}

/** 跨模块统计投影；只由 Integration 更新，Presentation 读取。 */
export class GameplayStatisticsState extends State {
    score = 0;
    zombies = 0;
    bullets = 0;
    expOrbs = 0;
    entities = 0;
    wallHp = 0;
    wallMaxHp = 0;
}

