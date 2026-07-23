import type { Mut } from "@zero-ecs/game";
import { RandomService } from "@zero-ecs/game/random";
import { ProgressionState, UpgradeType } from "./state";

const UPGRADES: readonly UpgradeType[] = [
    UpgradeType.Damage,
    UpgradeType.AttackSpeed,
    UpgradeType.Scatter,
    UpgradeType.Split,
    UpgradeType.Ricochet,
    UpgradeType.Burst,
    UpgradeType.CritChance,
    UpgradeType.CritDamage,
    UpgradeType.FlatDamage,
    UpgradeType.DamageMultiplier,
];

/** Progression 领域策略：生成互不重复的升级候选。 */
export function pickUpgrades(random: RandomService, count: number): UpgradeType[] {
    const pool = UPGRADES.slice();
    const result: UpgradeType[] = [];
    while (result.length < count && pool.length > 0) {
        const index = random.int(pool.length);
        result.push(pool[index]);
        pool[index] = pool[pool.length - 1];
        pool.length--;
    }
    return result;
}

/** Progression 领域策略：应用一个已选择的升级。 */
export function applyUpgrade(progression: Mut<ProgressionState>, upgrade: UpgradeType): void {
    switch (upgrade) {
        case UpgradeType.Damage: progression.damageLevel++; break;
        case UpgradeType.AttackSpeed: progression.attackSpeedLevel++; break;
        case UpgradeType.Scatter: progression.scatterLevel++; break;
        case UpgradeType.Split: progression.splitLevel++; break;
        case UpgradeType.Ricochet: progression.ricochetLevel++; break;
        case UpgradeType.Burst: progression.burstLevel++; break;
        case UpgradeType.CritChance: progression.critChanceLevel++; break;
        case UpgradeType.CritDamage: progression.critDamageLevel++; break;
        case UpgradeType.FlatDamage: progression.flatDamageLevel++; break;
        case UpgradeType.DamageMultiplier: progression.damageMultiplierLevel++; break;
    }
}
