import { State } from "zero-ecs-lib";

export const enum GameMode { Playing, LevelUp, GameOver }

export const enum UpgradeType {
    Damage = 0,
    AttackSpeed = 1,
    Scatter = 2,
    Split = 3,
    Ricochet = 4,
    Burst = 5,
    CritChance = 6,
    CritDamage = 7,
    FlatDamage = 8,
    DamageMultiplier = 9,
}

export const UPGRADE_NAMES: Record<number, string> = {
    [UpgradeType.Damage]: "攻击力",
    [UpgradeType.AttackSpeed]: "攻速",
    [UpgradeType.Scatter]: "散射数量",
    [UpgradeType.Split]: "子弹分裂",
    [UpgradeType.Ricochet]: "子弹弹射",
    [UpgradeType.Burst]: "连射数量",
    [UpgradeType.CritChance]: "暴击提高",
    [UpgradeType.CritDamage]: "暴击伤害",
    [UpgradeType.FlatDamage]: "伤害增加",
    [UpgradeType.DamageMultiplier]: "伤害总增",
};

export const UPGRADE_DESCRIPTIONS: Record<number, (level: number) => string> = {
    [UpgradeType.Damage]: (lvl: number) =>
        `攻击力 +15% (${(5 * (1 + lvl * 0.15)).toFixed(1)}dmg, Lv.${lvl})`,
    [UpgradeType.AttackSpeed]: (lvl: number) =>
        `攻速 +15% (${(2 / (1 + lvl * 0.15)).toFixed(2)}s, Lv.${lvl})`,
    [UpgradeType.Scatter]: (lvl: number) => `散射箭 +1 (当前 Lv.${lvl})`,
    [UpgradeType.Split]: (lvl: number) =>
        `命中分裂 ${lvl === 0 ? 0 : lvl + 1}颗 (当前 Lv.${lvl})`,
    [UpgradeType.Ricochet]: (lvl: number) => `弹射次数 +1 (当前 Lv.${lvl})`,
    [UpgradeType.Burst]: (lvl: number) => `连射弹数 +1 (当前 Lv.${lvl})`,
    [UpgradeType.CritChance]: (lvl: number) =>
        `暴击率 +5% (${((0.05 * (1 + lvl * 0.05)) * 100).toFixed(1)}%, Lv.${lvl})`,
    [UpgradeType.CritDamage]: (lvl: number) =>
        `暴伤 +15% (×${(1.5 * (1 + lvl * 0.15)).toFixed(2)}, Lv.${lvl})`,
    [UpgradeType.FlatDamage]: (lvl: number) => `伤害 +8 (当前 Lv.${lvl})`,
    [UpgradeType.DamageMultiplier]: (lvl: number) =>
        `总伤害 ×${(1 + lvl * 0.15).toFixed(2)} (当前 Lv.${lvl})`,
};

export class GameState extends State {
    score = 0;
    wave = 0;
    waveTimer = 0;
    spawnQueue = 0;
    spawnTimer = 0;
    xp = 0;
    xpToNext = 0;
    level = 0;
    zombies = 0;
    bullets = 0;
    expOrbs = 0;
    entities = 0;
    mode = GameMode.Playing;
    skipTick = 0;
    wallHp = 0;
    wallMaxHp = 0;

    /** Upgrade levels */
    damageLevel = 1;
    attackSpeedLevel = 1;
    scatterLevel = 1;
    splitLevel = 0;
    ricochetLevel = 1;
    burstLevel = 1;
    critChanceLevel = 1;
    critDamageLevel = 1;
    flatDamageLevel = 1;
    damageMultiplierLevel = 1;

    /** Base zombie count per wave (grows after boss waves) */
    baseZombieCount = 1;

    /** Horde / wave phases */
    inHorde = false;
    waveZombieTotal = 0;
    waveDuration = 8;

    /** Offered upgrade choices (set externally when LevelUp) */
    upgradeOptions: UpgradeType[] = [];
}
