import { Resource } from "@zero-ecs/game";

export class GameConfigResource extends Resource {
    readonly width = 960;
    readonly height = 640;
    readonly shooterX = 70;
    readonly shooterY = 320;


    readonly wallX = 210;
    readonly wallY = 320;
    readonly wallHalfWidth = 12;
    readonly wallHalfHeight = 260;
    readonly wallInitialHp = 2000;

    readonly zombieSpawnX = 920;
    readonly zombieSpawnYMin = 80;
    readonly zombieSpawnYMax = 560;
    readonly zombieBaseHp = 10;
    readonly zombieHpGrowth = 15;
    readonly zombieBaseSpeed = 20;
    readonly zombieSpeedGrowth = 4;
    readonly zombieBaseXp = 30;
    readonly zombieXpGrowth = 5;
    readonly zombieDamageBase = 3;
    readonly zombieRadius = 14;
    readonly zombieHalfWidth = 12;
    readonly zombieHalfHeight = 16;
    readonly restTime = 3.0;
    readonly zombiePerWaveGrowth = 2;
    readonly spawnDelayMin = 1.5;
    readonly spawnDelayMax = 4.0;

    readonly waveInterval = 60;
    readonly zombiePerWaveBase = 5;

    readonly bulletRadius = 5;
    readonly bulletSpeed = 800;
    readonly bulletLifetime = 1.5;
    readonly bulletBaseDamage = 5;

    readonly shooterFireInterval = 2.0;
    readonly shooterMinFireInterval = 0.15;
    readonly shooterCritChance = 0.05;
    readonly shooterCritMult = 1.5;
    readonly shooterScatterBase = 1;
    readonly shooterSplitBase = 2;
    readonly shooterRicochetBase = 0;
    readonly shooterBurstBase = 1;

    readonly upgradeDamageGrowth = 0.15;
    readonly upgradeAttackSpeed = 0.15;
    readonly upgradeCritChanceBonus = 0.05;
    readonly upgradeCritDamageBonus = 0.15;
    readonly upgradeScatter = 1;
    readonly upgradeSplit = 1;
    readonly upgradeRicochet = 1;
    readonly upgradeBurst = 1;
    readonly upgradeFlatDamage = 8;
    readonly upgradeDamageMultiplier = 0.15;
    readonly bossWaveInterval = 5;
    readonly bossWaveMultiplier = 1.5;
    readonly baseZombieGrowth = 2;
    readonly xpBase = 25;
    readonly xpGrowth = 25;
    readonly expOrbSpeed = 80;



    readonly maxBullets = 5000;
    readonly maxZombies = 80;
    readonly maxExpOrbs = 300;
}
