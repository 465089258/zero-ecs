import {
    CommandService,
    RandomService,
    Resource,
    Service,
    State,
} from "zero-ecs-lib";
import {
    Bullet,
    BulletType,
    DamageText,
    DamageTextType,
    ExpOrb,
    ExpOrbType,
    GameEntityType,
    Position,
    PositionType,
    Shooter,
    ShooterType,
    Velocity,
    VelocityType,
    Wall,
    WallType,
    Zombie,
    ZombieType,
} from "../components";
import { GameConfigResource } from "../resources";
import { GameState } from "../states";

export class SpawnService extends Service {
    @Service.inject(CommandService) private readonly commands!: CommandService;
    @Service.inject(RandomService) private readonly random!: RandomService;
    @Resource.inject(GameConfigResource) private readonly config!: GameConfigResource;
    @State.inject(GameState) private readonly game!: GameState;

    spawnGame(): void {
        this.spawnShooter();
        this.spawnWall();
    }

    spawnShooter(): void {
        const c = this.config;
        const g = this.game;
        const attackBonus = (g.attackSpeedLevel - 1) * c.upgradeAttackSpeed;
        const fireInterval = c.shooterFireInterval / (1 + attackBonus);
        const baseDamage = c.bulletBaseDamage * (1 + (g.damageLevel - 1) * c.upgradeDamageGrowth);
        const flatDamage = (g.flatDamageLevel - 1) * c.upgradeFlatDamage;
        const damageMultiplier = 1 + (g.damageMultiplierLevel - 1) * c.upgradeDamageMultiplier;
        const damage = (baseDamage + flatDamage) * damageMultiplier;
        const critBonus = (g.critChanceLevel - 1) * c.upgradeCritChanceBonus;
        const critChance = c.shooterCritChance * (1 + critBonus);
        const critDmgBonus = (g.critDamageLevel - 1) * c.upgradeCritDamageBonus;
        const critMult = c.shooterCritMult * (1 + critDmgBonus);

        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, c.shooterX)
            .set(PositionType, Position.y, c.shooterY)
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
            .set(ShooterType, Shooter.burstLeft, 0)
            .submit();
    }

    spawnWall(): void {
        const c = this.config;
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, c.wallX)
            .set(PositionType, Position.y, c.wallY)
            .add(WallType)
            .set(WallType, Wall.hp, c.wallInitialHp)
            .set(WallType, Wall.maxHp, c.wallInitialHp)
            .submit();
    }

    spawnBullet(x: number, y: number, angle: number, damage: number, splitCount: number, ricochetCount: number): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, x)
            .set(PositionType, Position.y, y)
            .add(VelocityType)
            .set(VelocityType, Velocity.x, Math.cos(angle) * this.config.bulletSpeed)
            .set(VelocityType, Velocity.y, Math.sin(angle) * this.config.bulletSpeed)
            .add(BulletType)
            .set(BulletType, Bullet.damage, damage)
            .set(BulletType, Bullet.radius, this.config.bulletRadius)
            .set(BulletType, Bullet.speed, this.config.bulletSpeed)
            .set(BulletType, Bullet.splitCount, splitCount)
            .set(BulletType, Bullet.ricochetCount, ricochetCount)
            .set(BulletType, Bullet.pierce, 0)
            .set(BulletType, Bullet.lifetime, this.config.bulletLifetime)
            .set(BulletType, Bullet.active, 1)
            .submit();
    }

    spawnZombie(wave: number): void {
        const c = this.config;
        const hp = c.zombieBaseHp + wave * wave * 2;
        const speed = c.zombieBaseSpeed + wave * 3 + wave * wave * 0.5;
        const xp = c.zombieBaseXp + wave * wave * 1.5;
        const damage = c.zombieDamage + wave * 0.3;
        const y = this.random.float(c.zombieSpawnYMin, c.zombieSpawnYMax);

        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, c.zombieSpawnX)
            .set(PositionType, Position.y, y)
            .add(VelocityType)
            .set(VelocityType, Velocity.x, -speed)
            .set(VelocityType, Velocity.y, 0)
            .add(ZombieType)
            .set(ZombieType, Zombie.hp, hp)
            .set(ZombieType, Zombie.maxHp, hp)
            .set(ZombieType, Zombie.speed, speed)
            .set(ZombieType, Zombie.xp, xp)
            .set(ZombieType, Zombie.damage, damage)
            .set(ZombieType, Zombie.active, 1)
            .submit();
    }

    spawnZombieAt(wave: number, x: number, y: number): void {
        const c = this.config;
        const hp = c.zombieBaseHp + wave * wave * 2;
        const speed = c.zombieBaseSpeed + wave * 3 + wave * wave * 0.5;
        const xp = c.zombieBaseXp + wave * wave * 1.5;
        const damage = c.zombieDamage + wave * 0.3;

        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, x)
            .set(PositionType, Position.y, y)
            .add(VelocityType)
            .set(VelocityType, Velocity.x, -speed)
            .set(VelocityType, Velocity.y, 0)
            .add(ZombieType)
            .set(ZombieType, Zombie.hp, hp)
            .set(ZombieType, Zombie.maxHp, hp)
            .set(ZombieType, Zombie.speed, speed)
            .set(ZombieType, Zombie.xp, xp)
            .set(ZombieType, Zombie.damage, damage)
            .set(ZombieType, Zombie.active, 1)
            .submit();
    }

    spawnExpOrb(x: number, y: number, value: number): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, x)
            .set(PositionType, Position.y, y)
            .add(VelocityType)
            .set(VelocityType, Velocity.x, -this.config.expOrbSpeed)
            .set(VelocityType, Velocity.y, 0)
            .add(ExpOrbType)
            .set(ExpOrbType, ExpOrb.value, value)
            .set(ExpOrbType, ExpOrb.radius, 6)
            .set(ExpOrbType, ExpOrb.active, 1)
            .submit();
    }

    spawnDamageText(x: number, y: number, value: number): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, x)
            .set(PositionType, Position.y, y)
            .add(DamageTextType)
            .set(DamageTextType, DamageText.value, value)
            .set(DamageTextType, DamageText.lifetime, 0.7)
            .set(DamageTextType, DamageText.floatY, y)
            .submit();
    }
}
