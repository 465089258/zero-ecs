import { State } from "zero-ecs-lib";

export const enum GameMode { Playing, LevelUp, GameOver }
export const enum WavePhase { Spawning, Fighting, Horde, Resting }
export const enum UpgradeType {
    Damage = 0, AttackSpeed = 1, Scatter = 2, Split = 3,
    Ricochet = 4, Burst = 5, CritChance = 6, CritDamage = 7,
    FlatDamage = 8, DamageMultiplier = 9,
}

export const UPGRADE_NAMES: Record<number, string> = {
    [UpgradeType.Damage]: "攻击力", [UpgradeType.AttackSpeed]: "攻速",
    [UpgradeType.Scatter]: "散射数量", [UpgradeType.Split]: "子弹分裂",
    [UpgradeType.Ricochet]: "子弹弹射", [UpgradeType.Burst]: "连射数量",
    [UpgradeType.CritChance]: "暴击提高", [UpgradeType.CritDamage]: "暴击伤害",
    [UpgradeType.FlatDamage]: "伤害增加", [UpgradeType.DamageMultiplier]: "伤害总增",
};

export const UPGRADE_DESCRIPTIONS: Record<number, (level: number) => string> = {
    [UpgradeType.Damage]: (l: number) => `攻击力 +15% (${(5*(1+l*0.15)).toFixed(1)}dmg, Lv.${l})`,
    [UpgradeType.AttackSpeed]: (l: number) => `攻速 +15% (${(2/(1+l*0.15)).toFixed(2)}s, Lv.${l})`,
    [UpgradeType.Scatter]: (l: number) => `散射箭 +1 (当前 Lv.${l})`,
    [UpgradeType.Split]: (l: number) => `命中分裂 ${l===0?0:l+1}颗 (当前 Lv.${l})`,
    [UpgradeType.Ricochet]: (l: number) => `弹射次数 +1 (当前 Lv.${l})`,
    [UpgradeType.Burst]: (l: number) => `连射弹数 +1 (当前 Lv.${l})`,
    [UpgradeType.CritChance]: (l: number) => `暴击率 +5% (${((0.05*(1+l*0.05))*100).toFixed(1)}%, Lv.${l})`,
    [UpgradeType.CritDamage]: (l: number) => `暴伤 +15% (×${(1.5*(1+l*0.15)).toFixed(2)}, Lv.${l})`,
    [UpgradeType.FlatDamage]: (l: number) => `伤害 +8 (当前 Lv.${l})`,
    [UpgradeType.DamageMultiplier]: (l: number) => `总伤害 ×${(1+l*0.15).toFixed(2)} (当前 Lv.${l})`,
};

export class GameState extends State {
    score = 0;
    xp = 0;
    xpToNext = 50;
    level = 0;
    mode = GameMode.Playing;
    skipTick = 0;
    zombies = 0;
    bullets = 0;
    expOrbs = 0;
    entities = 0;
    wallHp = 0;
    wallMaxHp = 0;
    upgradeOptions: UpgradeType[] = [];
}
