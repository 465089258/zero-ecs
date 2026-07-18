import { CommandService, RandomService, type Entity, type Mut } from "zero-ecs-lib";
import { GameMode, GameState, UpgradeType } from "../common/game-state";
import { ShooterState } from "../shooter/state";
import { GameConfig } from "../common/game-config";
import { ShooterConfig } from "../shooter/config";
import { InputService } from "../common/input-service";
import { spawnShooter } from "../shooter/spawn";
import type { Shooters } from "../shooter/types";

const ALL_UPGRADES: UpgradeType[] = [
    UpgradeType.Damage, UpgradeType.AttackSpeed, UpgradeType.Scatter,
    UpgradeType.Split, UpgradeType.Ricochet, UpgradeType.Burst,
    UpgradeType.CritChance, UpgradeType.CritDamage,
    UpgradeType.FlatDamage, UpgradeType.DamageMultiplier,
];

export function levelUpSystem(
    game: Mut<GameState>, shooterSt: Mut<ShooterState>,
    random: RandomService, input: InputService,
    commands: CommandService, gameCfg: Readonly<GameConfig>, shooterCfg: Readonly<ShooterConfig>,
    shooter: Shooters,
): void {
    if (game.skipTick) return;
    if (game.mode === GameMode.LevelUp) {
        const choice = input.consumeUpgrade();
        if (choice < 0 || choice > 2) return;
        const selected = game.upgradeOptions[choice];
        if (selected === undefined) return;
        applyUpgrade(shooterSt, selected);
        const sIter = shooter.iter();
        while (sIter.next()) { const [sCount, sEntities] = sIter.current; for (let i = 0; i < sCount; i++) commands.entity(sEntities[i] as Entity).despawn().submit(); }
        spawnShooter(commands, gameCfg, shooterCfg, shooterSt);
        game.mode = GameMode.Playing; game.skipTick = 1; game.upgradeOptions = [];
        return;
    }
    if (game.mode !== GameMode.Playing) return;
    if (game.xp >= game.xpToNext) {
        game.xp -= game.xpToNext; game.level++;
        game.xpToNext = Math.floor(50 + game.level * 45 + game.level * game.level * 5);
        game.upgradeOptions = pickUpgrades(random, 3); game.mode = GameMode.LevelUp;
    }
}

function applyUpgrade(st: Mut<ShooterState>, upgrade: UpgradeType): void {
    switch (upgrade) {
        case UpgradeType.Damage: st.damageLevel++; break;
        case UpgradeType.AttackSpeed: st.attackSpeedLevel++; break;
        case UpgradeType.Scatter: st.scatterLevel++; break;
        case UpgradeType.Split: st.splitLevel++; break;
        case UpgradeType.Ricochet: st.ricochetLevel++; break;
        case UpgradeType.Burst: st.burstLevel++; break;
        case UpgradeType.CritChance: st.critChanceLevel++; break;
        case UpgradeType.CritDamage: st.critDamageLevel++; break;
        case UpgradeType.FlatDamage: st.flatDamageLevel++; break;
        case UpgradeType.DamageMultiplier: st.damageMultiplierLevel++; break;
    }
}
function pickUpgrades(random: RandomService, count: number): UpgradeType[] {
    const pool = [...ALL_UPGRADES]; const result: UpgradeType[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) { const idx = random.int(0, pool.length - 1); result.push(pool[idx]); pool.splice(idx, 1); }
    return result;
}
