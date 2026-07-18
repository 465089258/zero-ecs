import { Types, type Component } from "zero-ecs-lib";

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
