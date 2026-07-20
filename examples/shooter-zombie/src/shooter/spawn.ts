import { CommandService } from "zero-ecs-lib";
import { Shooter, ShooterType } from "./components";
import { Position, PositionType, GameEntityType } from "../common/components";
import { ShooterConfig } from "./config";
import { ShooterState } from "./state";
import { GameConfig } from "../common/game-config";

export function spawnShooter(commands: CommandService, gameCfg: GameConfig, cfg: ShooterConfig, state: ShooterState): void {
    const attackBonus = (state.attackSpeedLevel - 1) * cfg.upgradeAttackSpeed;
    const fireInterval = cfg.fireInterval / (1 + attackBonus);
    const baseDamage = cfg.bulletBaseDamage * (1 + (state.damageLevel - 1) * cfg.upgradeDamageGrowth);
    const flatDamage = (state.flatDamageLevel - 1) * cfg.upgradeFlatDamage;
    const dmgMul = 1 + (state.damageMultiplierLevel - 1) * cfg.upgradeDamageMultiplier;
    const damage = (baseDamage + flatDamage) * dmgMul;
    const critBonus = (state.critChanceLevel - 1) * cfg.upgradeCritChanceBonus;
    const critChance = cfg.critChance * (1 + critBonus);
    const critDmgBonus = (state.critDamageLevel - 1) * cfg.upgradeCritDamageBonus;
    const critMult = cfg.critMult * (1 + critDmgBonus);

    commands.spawn()
        .add(GameEntityType).add(PositionType)
        .set(PositionType, Position.x, gameCfg.shooterX).set(PositionType, Position.y, gameCfg.shooterY)
        .add(ShooterType)
        .set(ShooterType, Shooter.fireTimer, 0)
        .set(ShooterType, Shooter.fireInterval, Math.max(cfg.minFireInterval, fireInterval))
        .set(ShooterType, Shooter.damage, damage)
        .set(ShooterType, Shooter.critChance, Math.min(critChance, 0.95))
        .set(ShooterType, Shooter.critMult, critMult)
        .set(ShooterType, Shooter.scatter, cfg.scatterBase + (state.scatterLevel - 1) * cfg.upgradeScatter)
        .set(ShooterType, Shooter.split, state.splitLevel === 0 ? 0 : state.splitLevel + 1)
        .set(ShooterType, Shooter.ricochet, cfg.ricochetBase + (state.ricochetLevel - 1) * cfg.upgradeRicochet)
        .set(ShooterType, Shooter.burst, cfg.burstBase + (state.burstLevel - 1) * cfg.upgradeBurst)
        .set(ShooterType, Shooter.burstCooldown, 0).set(ShooterType, Shooter.burstLeft, 0)
        .submit();
}
