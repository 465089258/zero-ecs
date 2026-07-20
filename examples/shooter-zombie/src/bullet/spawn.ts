import { CommandService } from "zero-ecs-lib";
import { Position, PositionType, Velocity, VelocityType, GameEntityType } from "../common/components";
import { Bullet, BulletType } from "./components";
import { BulletConfig } from "./config";

export function spawnBullet(
    commands: CommandService,
    cfg: BulletConfig,
    x: number, y: number, angle: number,
    damage: number, splitCount: number, ricochetCount: number,
    ignoreEntity: number, isCrit: number,
): void {
    commands.spawn()
        .add(GameEntityType).add(PositionType)
        .set(PositionType, Position.x, x).set(PositionType, Position.y, y)
        .add(VelocityType)
        .set(VelocityType, Velocity.x, Math.cos(angle) * cfg.speed)
        .set(VelocityType, Velocity.y, Math.sin(angle) * cfg.speed)
        .add(BulletType)
        .set(BulletType, Bullet.damage, damage)
        .set(BulletType, Bullet.radius, cfg.radius)
        .set(BulletType, Bullet.speed, cfg.speed)
        .set(BulletType, Bullet.splitCount, splitCount)
        .set(BulletType, Bullet.ricochetCount, ricochetCount)
        .set(BulletType, Bullet.pierce, 0)
        .set(BulletType, Bullet.lifetime, cfg.lifetime)
        .set(BulletType, Bullet.ignoreEntity, ignoreEntity)
        .set(BulletType, Bullet.isCrit, isCrit)
        .set(BulletType, Bullet.active, 1)
        .submit();
}
