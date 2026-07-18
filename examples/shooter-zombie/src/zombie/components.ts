import { Types, type Component } from "zero-ecs-lib";
export const enum Zombie { hp, maxHp, speed, xp, damage, damageReduction, active }
export class ZombieType implements Component<Zombie> {
    readonly [Zombie.hp] = Types.F32;
    readonly [Zombie.maxHp] = Types.F32;
    readonly [Zombie.speed] = Types.F32;
    readonly [Zombie.xp] = Types.F32;
    readonly [Zombie.damage] = Types.F32;
    readonly [Zombie.damageReduction] = Types.F32;
    readonly [Zombie.active] = Types.U8;
}
