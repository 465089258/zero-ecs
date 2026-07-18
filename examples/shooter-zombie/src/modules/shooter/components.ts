import { Types, type Component } from "zero-ecs-lib";

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
