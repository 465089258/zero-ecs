import { Resource } from "@zero-ecs/game";

export enum RogueUpgrade {
    TemperSword,
    ShortenCooldown,
    BodyTechnique,
    ProtectiveBody,
    GatherSpirit,
}

export class RogueUpgradeCatalog extends Resource {
    readonly names = Object.freeze([
        "淬炼剑锋",
        "缩短行气",
        "身法精进",
        "护体真元",
        "聚灵法域",
    ]);

    readonly descriptions = Object.freeze([
        "飞剑伤害提高 25%",
        "自动御剑冷却缩短 10%",
        "移动速度提高 12%",
        "最大生命增加 20，并恢复 20",
        "灵蕴吸附范围提高 25%",
    ]);

    readonly count = this.names.length;
}
