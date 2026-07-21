import { Commands, RandomService, Resource, Service, State } from "@zero-ecs/game";
import { Health, HealthType } from "../attribute";
import { Float2, GameConfigResource, GameEntityType, PositionType, VelocityType } from "../common";
import { DamageText, DamageTextType } from "../feedback";
import { Bullet, BulletType } from "../projectile";
import { ExperienceCollectorType, ExpOrb, ExpOrbType, ProgressionState } from "../progression";
import { Shooter, ShooterType } from "../shooter";
import { WallType, Zombie, ZombieType } from "../zombie";
import { ProjectileDamagePayload, ProjectileDamagePayloadType } from "./components";

/**
 * 游戏内容组装边界。它可以依赖所有功能模块，但功能模块不应反向依赖它。
 * 这里集中保存“本游戏的僵尸有生命值、子弹携带伤害”等不可避免的组合规则。
 */
export class GameContentService extends Service {
    @Service.inject(Commands) private readonly commands!: Commands;
    @Service.inject(RandomService) private readonly random!: RandomService;
    @Resource.inject(GameConfigResource) private readonly config!: GameConfigResource;
    @State.inject(ProgressionState) private readonly progression!: ProgressionState;

    spawnGame(): void {
        this.spawnShooter();
        this.spawnWall();
    }

    spawnShooter(): void {
        const c = this.config;
        const g = this.progression;
        const fireInterval = c.shooterFireInterval / (1 + (g.attackSpeedLevel - 1) * c.upgradeAttackSpeed);
        const baseDamage = c.bulletBaseDamage * (1 + (g.damageLevel - 1) * c.upgradeDamageGrowth);
        const damage = (baseDamage + (g.flatDamageLevel - 1) * c.upgradeFlatDamage)
            * (1 + (g.damageMultiplierLevel - 1) * c.upgradeDamageMultiplier);
        const critChance = c.shooterCritChance
            * (1 + (g.critChanceLevel - 1) * c.upgradeCritChanceBonus);
        const critMult = c.shooterCritMult
            * (1 + (g.critDamageLevel - 1) * c.upgradeCritDamageBonus);

        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Float2.x, c.shooterX)
            .set(PositionType, Float2.y, c.shooterY)
            .add(ExperienceCollectorType)
            .add(ShooterType)
            .set(ShooterType, Shooter.fireTimer, 0)
            .set(ShooterType, Shooter.fireInterval, Math.max(c.shooterMinFireInterval, fireInterval))
            .set(ShooterType, Shooter.damage, damage)
            .set(ShooterType, Shooter.critChance, Math.min(critChance, 0.95))
            .set(ShooterType, Shooter.critMult, critMult)
            .set(ShooterType, Shooter.scatter, c.shooterScatterBase + (g.scatterLevel - 1) * c.upgradeScatter)
            .set(ShooterType, Shooter.split, g.splitLevel === 0 ? 0 : g.splitLevel + 1)
            .set(ShooterType, Shooter.ricochet, c.shooterRicochetBase + (g.ricochetLevel - 1) * c.upgradeRicochet)
            .set(ShooterType, Shooter.burst, c.shooterBurstBase + (g.burstLevel - 1) * c.upgradeBurst)
            .set(ShooterType, Shooter.burstCooldown, 0)
            .set(ShooterType, Shooter.burstLeft, 0).submit();
    }

    spawnWall(): void {
        const c = this.config;
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Float2.x, c.wallX)
            .set(PositionType, Float2.y, c.wallY)
            .add(WallType)
            .add(HealthType)
            .set(HealthType, Health.current, c.wallInitialHp)
            .set(HealthType, Health.max, c.wallInitialHp).submit();
    }

    spawnBullet(
        x: number,
        y: number,
        angle: number,
        damage: number,
        splitCount: number,
        ricochetCount: number,
    ): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Float2.x, x)
            .set(PositionType, Float2.y, y)
            .add(VelocityType)
            .set(VelocityType, Float2.x, Math.cos(angle) * this.config.bulletSpeed)
            .set(VelocityType, Float2.y, Math.sin(angle) * this.config.bulletSpeed)
            .add(BulletType)
            .set(BulletType, Bullet.radius, this.config.bulletRadius)
            .set(BulletType, Bullet.speed, this.config.bulletSpeed)
            .set(BulletType, Bullet.splitCount, splitCount)
            .set(BulletType, Bullet.ricochetCount, ricochetCount)
            .set(BulletType, Bullet.pierce, 0)
            .set(BulletType, Bullet.lifetime, this.config.bulletLifetime)
            .set(BulletType, Bullet.active, 1)
            .add(ProjectileDamagePayloadType)
            .set(ProjectileDamagePayloadType, ProjectileDamagePayload.amount, damage).submit();
    }

    spawnZombie(wave: number): void {
        this.spawnZombieAt(
            wave,
            this.config.zombieSpawnX,
            this.random.float(this.config.zombieSpawnYMin, this.config.zombieSpawnYMax),
        );
    }

    spawnZombieAt(wave: number, x: number, y: number): void {
        const c = this.config;
        const hp = c.zombieBaseHp + wave * wave * 2;
        const speed = c.zombieBaseSpeed + wave * 3 + wave * wave * 0.5;
        const xp = c.zombieBaseXp + wave * wave * 1.5;
        const damage = c.zombieDamageBase + wave * 0.3;
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Float2.x, x)
            .set(PositionType, Float2.y, y)
            .add(VelocityType)
            .set(VelocityType, Float2.x, -speed)
            .set(VelocityType, Float2.y, 0)
            .add(ZombieType)
            .set(ZombieType, Zombie.speed, speed)
            .set(ZombieType, Zombie.xp, xp)
            .set(ZombieType, Zombie.damage, damage)
            .set(ZombieType, Zombie.active, 1)
            .add(HealthType)
            .set(HealthType, Health.current, hp)
            .set(HealthType, Health.max, hp).submit();
    }

    spawnExpOrb(x: number, y: number, value: number): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Float2.x, x)
            .set(PositionType, Float2.y, y)
            .add(VelocityType)
            .set(VelocityType, Float2.x, -this.config.expOrbSpeed)
            .set(VelocityType, Float2.y, 0)
            .add(ExpOrbType)
            .set(ExpOrbType, ExpOrb.value, value)
            .set(ExpOrbType, ExpOrb.radius, 6)
            .set(ExpOrbType, ExpOrb.active, 1).submit();
    }

    spawnDamageText(x: number, y: number, value: number): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Float2.x, x)
            .set(PositionType, Float2.y, y)
            .add(DamageTextType)
            .set(DamageTextType, DamageText.value, value)
            .set(DamageTextType, DamageText.lifetime, 0.7)
            .set(DamageTextType, DamageText.floatY, y).submit();
    }
}
