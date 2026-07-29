import { Resource } from "@zero-ecs/game";

export enum RogueUpgrade {
    TemperSword,
    ShortenCooldown,
    BodyTechnique,
    ProtectiveBody,
    GatherSpirit,
    AddSword,
    ScatterRange,
    FocusPower,
    FormationPower,
    FormationTempo,
    FusionPower,
    FusionEfficiency,
    FusionEndurance,
    FormationRange,
    LightningIntent,
    MetalIntent,
    FireIntent,
    ColdIntent,
    ExpandSwordContainer,
    StrengthenSpiritualSense,
}

export class RogueUpgradeCatalog extends Resource {
    readonly names = Object.freeze([
        "淬炼剑锋",
        "分光 · 行气无滞",
        "身法精进",
        "护体真元",
        "聚灵法域",
        "添置飞剑",
        "分光 · 神识扩域",
        "归一 · 贯日",
        "周天 · 剑罡",
        "周天 · 疾旋",
        "合一 · 摧岳",
        "合一 · 流转",
        "合一 · 踏虚",
        "周天 · 广域",
        "雷意 · 惊蛰",
        "金意 · 破势",
        "火意 · 焚心",
        "寒意 · 凝霜",
        "扩建剑夹",
        "神识精进",
    ]);

    readonly descriptions = Object.freeze([
        "飞剑伤害提高 25%",
        "分散御剑返阵后的再攻击间隔缩短 10%",
        "移动速度提高 12%",
        "最大生命增加 20，并恢复 20",
        "灵蕴吸附范围提高 25%",
        "增加一把飞剑，最多拥有 49 把",
        "分散御剑的自动索敌范围提高 20%",
        "集火剑诀伤害提高 35%",
        "周天剑阵接触伤害提高 25%",
        "周天剑阵运行速度提高 15%，触发间隔缩短 15%",
        "身剑合一伤害提高 30%",
        "身剑合一每秒体力消耗降低 15%",
        "最大体力增加 20，体力恢复提高 10%",
        "周天剑阵运行范围提高 18%",
        "飞剑首次命中后向附近敌人连锁雷霆；再次感悟提高雷霆伤害",
        "集火与身剑合一贯穿同一直线的后续敌人时追加破势伤害",
        "集火与剑阵命中积累火印，达到四层时引爆周围敌人",
        "分散与剑阵命中积累寒气，叠层降低敌人的移动速度",
        "剑夹容量增加 2",
        "神识提高 1，同时多操控一把飞剑",
    ]);

    readonly count = this.names.length;
}
