import { Resource } from "@zero-ecs/game";

export enum EnemyKind {
    CorruptedBat,
    BonePuppet,
    StoneGolem,
    SwordWraith,
}

/**
 * 示例内容目录。稳定帧按数字 Kind 直接读取列，不创建敌人定义对象。
 */
export class EnemyCatalog extends Resource {
    readonly health = new Float32Array([24, 52, 190, 420]);
    readonly speed = new Float32Array([4.1, 2.35, 1.35, 2.8]);
    readonly acceleration = new Float32Array([32, 20, 13, 26]);
    readonly radius = new Float32Array([0.42, 0.52, 0.86, 0.65]);
    readonly centerHeight = new Float32Array([0.8, 0.78, 1.05, 0.9]);
    readonly contactDamage = new Float32Array([6, 9, 18, 24]);
    readonly experience = new Float32Array([1, 2, 6, 12]);
    readonly lifeOnKillRatio =
        new Float32Array([0.0015, 0.0025, 0.008, 0.015]);
    readonly lifePickupChance =
        new Float32Array([0.03, 0.06, 0.3, 0.65]);
    readonly lifePickupRatio =
        new Float32Array([0.1, 0.1, 0.12, 0.15]);
    readonly priority = new Uint8Array([0, 0, 0, 1]);
    readonly cost = new Float32Array([0.65, 1, 3.2, 8]);
    readonly swordWraithEmpowermentRadius = 7;
    readonly swordWraithEmpowermentIntervalTicks = 180;
    readonly swordWraithEmpowermentDurationTicks = 240;
    readonly swordWraithEmpowermentSpeedMultiplier = 1.28;
    readonly swordWraithEmpowermentDamageMultiplier = 1.35;
}
