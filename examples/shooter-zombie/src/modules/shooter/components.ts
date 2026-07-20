import { Types, type Component } from "@zero-ecs/game";

export const enum Shooter {
    fireTimer,
    fireInterval,
    damage,
    critChance,
    critMult,
    scatter,
    split,
    ricochet,
    burst,
    burstCooldown,
    burstLeft,
}

export class ShooterType implements Component<Shooter> {
    readonly [Shooter.fireTimer] = Types.F32;
    readonly [Shooter.fireInterval] = Types.F32;
    readonly [Shooter.damage] = Types.F32;
    readonly [Shooter.critChance] = Types.F32;
    readonly [Shooter.critMult] = Types.F32;
    readonly [Shooter.scatter] = Types.U8;
    readonly [Shooter.split] = Types.U8;
    readonly [Shooter.ricochet] = Types.U8;
    readonly [Shooter.burst] = Types.U8;
    readonly [Shooter.burstCooldown] = Types.F32;
    readonly [Shooter.burstLeft] = Types.U8;
}

/**
 * Shooter 模块的输出契约：表达“完成了一次射击”，不指定子弹或伤害实现。
 * Shooter-Projectile Integration 负责把它投影成具体投射物。
 */
export const enum ShotRequest {
    source,
    x,
    y,
    damage,
    critChance,
    critMultiplier,
    scatter,
    split,
    ricochet,
}

export class ShotRequestType implements Component<ShotRequest> {
    readonly [ShotRequest.source] = Types.U32;
    readonly [ShotRequest.x] = Types.F32;
    readonly [ShotRequest.y] = Types.F32;
    readonly [ShotRequest.damage] = Types.F32;
    readonly [ShotRequest.critChance] = Types.F32;
    readonly [ShotRequest.critMultiplier] = Types.F32;
    readonly [ShotRequest.scatter] = Types.U8;
    readonly [ShotRequest.split] = Types.U8;
    readonly [ShotRequest.ricochet] = Types.U8;
}
