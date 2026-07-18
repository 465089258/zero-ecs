import { CommandService, RandomService } from "zero-ecs-lib";
import { Position, PositionType, Velocity, VelocityType, GameEntityType } from "../common/components";
import { Zombie, ZombieType } from "./components";
import { ZombieConfig } from "./config";
import { GameConfig } from "../common/game-config";

function stats(cfg: ZombieConfig, wave: number) {
    return {
        hp: cfg.baseHp + wave * wave * 3 + wave * wave * wave * 0.04,
        speed: cfg.baseSpeed + wave * 3 + wave * wave * 0.5,
        xp: cfg.baseXp + wave * wave * 1.0,
        wallDamage: cfg.damageBase + wave * 0.3 + wave * wave * 0.005,
        reduction: Math.min(wave * 0.004, 0.4),
    };
}

export function spawnZombie(commands: CommandService, random: RandomService, gameCfg: GameConfig, cfg: ZombieConfig, wave: number): void {
    const s = stats(cfg, wave);
    const y = random.float(gameCfg.zombieSpawnYMin, gameCfg.zombieSpawnYMax);
    commands.spawn()
        .add(GameEntityType).add(PositionType)
        .set(PositionType, Position.x, gameCfg.zombieSpawnX).set(PositionType, Position.y, y)
        .add(VelocityType).set(VelocityType, Velocity.x, -s.speed).set(VelocityType, Velocity.y, 0)
        .add(ZombieType)
        .set(ZombieType, Zombie.hp, s.hp).set(ZombieType, Zombie.maxHp, s.hp)
        .set(ZombieType, Zombie.speed, s.speed).set(ZombieType, Zombie.xp, s.xp)
        .set(ZombieType, Zombie.damage, s.wallDamage).set(ZombieType, Zombie.damageReduction, s.reduction)
        .set(ZombieType, Zombie.active, 1)
        .submit();
}

export function spawnZombieAt(commands: CommandService, cfg: ZombieConfig, wave: number, x: number, y: number): void {
    const s = stats(cfg, wave);
    commands.spawn()
        .add(GameEntityType).add(PositionType).set(PositionType, Position.x, x).set(PositionType, Position.y, y)
        .add(VelocityType).set(VelocityType, Velocity.x, -s.speed).set(VelocityType, Velocity.y, 0)
        .add(ZombieType)
        .set(ZombieType, Zombie.hp, s.hp).set(ZombieType, Zombie.maxHp, s.hp)
        .set(ZombieType, Zombie.speed, s.speed).set(ZombieType, Zombie.xp, s.xp)
        .set(ZombieType, Zombie.damage, s.wallDamage).set(ZombieType, Zombie.damageReduction, s.reduction)
        .set(ZombieType, Zombie.active, 1)
        .submit();
}
