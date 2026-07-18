import { RandomService } from "zero-ecs-lib";
import { UpgradeType } from "./game-state";

const ALL_UPGRADES: readonly UpgradeType[] = [
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

export function pickUpgrades(random: RandomService, count: number): UpgradeType[] {
    const pool = [...ALL_UPGRADES];
    const result: UpgradeType[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const index = random.int(pool.length);
        result.push(pool[index]);
        pool.splice(index, 1);
    }
    return result;
}
