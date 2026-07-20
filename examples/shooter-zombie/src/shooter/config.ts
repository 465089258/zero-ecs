import { Resource } from "zero-ecs-lib";

export class ShooterConfig extends Resource {
    readonly fireInterval = 2.0;
    readonly minFireInterval = 0.15;
    readonly bulletBaseDamage = 5;
    readonly critChance = 0.05;
    readonly critMult = 1.5;
    readonly scatterBase = 1;
    readonly splitBase = 2;
    readonly ricochetBase = 0;
    readonly burstBase = 1;
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
}
