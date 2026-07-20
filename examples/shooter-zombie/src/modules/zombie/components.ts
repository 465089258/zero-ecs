import { Types, type Component } from "@zero-ecs/game";

export const enum Zombie { speed, xp, damage, active }

export class ZombieType implements Component<Zombie> {
    readonly [Zombie.speed] = Types.F32;
    readonly [Zombie.xp] = Types.F32;
    readonly [Zombie.damage] = Types.F32;
    readonly [Zombie.active] = Types.U8;
}

/** 防线身份标记；生命值由独立 Attribute 模块提供。 */
export class WallType implements Component<never> {}
