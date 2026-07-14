import { Types, type Component } from "zero-ecs-lib";

export const enum Position { x, y }
export class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

export const enum Velocity { x, y }
export class VelocityType implements Component<Velocity> {
    readonly [Velocity.x] = Types.F32;
    readonly [Velocity.y] = Types.F32;
}

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

export const enum Bullet { damage, radius, speed, splitCount, ricochetCount, pierce, lifetime, active }
export class BulletType implements Component<Bullet> {
    readonly [Bullet.damage] = Types.F32;
    readonly [Bullet.radius] = Types.F32;
    readonly [Bullet.speed] = Types.F32;
    readonly [Bullet.splitCount] = Types.U8;
    readonly [Bullet.ricochetCount] = Types.U8;
    readonly [Bullet.pierce] = Types.U8;
    readonly [Bullet.lifetime] = Types.F32;
    readonly [Bullet.active] = Types.U8;
}

export const enum Zombie { hp, maxHp, speed, xp, damage, active }
export class ZombieType implements Component<Zombie> {
    readonly [Zombie.hp] = Types.F32;
    readonly [Zombie.maxHp] = Types.F32;
    readonly [Zombie.speed] = Types.F32;
    readonly [Zombie.xp] = Types.F32;
    readonly [Zombie.damage] = Types.F32;
    readonly [Zombie.active] = Types.U8;
}

export const enum Wall { hp, maxHp }
export class WallType implements Component<Wall> {
    readonly [Wall.hp] = Types.F32;
    readonly [Wall.maxHp] = Types.F32;
}

export const enum ExpOrb { value, radius, active }
export class ExpOrbType implements Component<ExpOrb> {
    readonly [ExpOrb.value] = Types.F32;
    readonly [ExpOrb.radius] = Types.F32;
    readonly [ExpOrb.active] = Types.U8;
}

export const enum UpgradeChoice { option0, option1, option2 }
export class UpgradeChoiceType implements Component<UpgradeChoice> {
    readonly [UpgradeChoice.option0] = Types.U8;
    readonly [UpgradeChoice.option1] = Types.U8;
    readonly [UpgradeChoice.option2] = Types.U8;
}

/** Marker used by the restart system to clear example-owned entities. */
export class GameEntityType implements Component<never> {}

export const enum DamageText { value, lifetime, floatY }
export class DamageTextType implements Component<DamageText> {
    readonly [DamageText.value] = Types.F32;
    readonly [DamageText.lifetime] = Types.F32;
    readonly [DamageText.floatY] = Types.F32;
}
