import {
    Commands,
    defSystem,
    RandomService,
    TimeState,
    Update,
    Write,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { Position, Velocity } from "../common/components";
import { GameMode, GameState, UpgradeType } from "../common/game-state";
import { GameConfigResource } from "../common/resources";
import { pickUpgrades } from "../common/upgrade-utils";
import { InputService } from "../common/services/input-service";
import { ShooterQuery } from "../shooter/queries";
import { DamageText, ExpOrb } from "./components";
import { DamageTextQuery, ExpOrbQuery } from "./queries";

type Shooters = QueryOf<typeof ShooterQuery>;
type ExpOrbs = QueryOf<typeof ExpOrbQuery>;
type DamageTexts = QueryOf<typeof DamageTextQuery>;

export const expCollectSystem = defSystem(Update.fixed, collectExperience, [
    GameConfigResource, Write(GameState), Commands, ExpOrbQuery, ShooterQuery,
]);
export const damageTextUpdateSystem = defSystem(Update.fixed, updateDamageTexts, [
    TimeState, GameState, Commands, DamageTextQuery,
]);
export const levelUpSystem = defSystem(Update.fixed, processLevelUp, [
    Write(GameState), RandomService, InputService,
]);

function collectExperience(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    commands: Commands,
    expOrbs: ExpOrbs,
    shooter: Shooters,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    let shooterX = config.shooterX;
    let shooterY = config.shooterY;
    const shooterIter = shooter.iter();
    while (shooterIter.next()) {
        const [count, , positions] = shooterIter.current;
        if (count > 0) {
            shooterX = positions[Position.x][0];
            shooterY = positions[Position.y][0];
        }
    }

    const iter = expOrbs.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, data] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const vxs = velocities[Velocity.x];
        const vys = velocities[Velocity.y];
        const active = data[ExpOrb.active];
        const values = data[ExpOrb.value];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            const dx = shooterX - xs[i];
            const dy = shooterY - ys[i];
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 18) {
                active[i] = 0;
                commands.entity(entities[i] as Entity).despawn().submit();
                game.xp += values[i];
                continue;
            }
            const speed = 420 + distance * 0.3;
            vxs[i] = dx / distance * speed;
            vys[i] = dy / distance * speed;
            xs[i] += vxs[i] * (1 / 120);
            ys[i] += vys[i] * (1 / 120);
        }
    }
}

function updateDamageTexts(
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: Commands,
    texts: DamageTexts,
): void {
    if (game.skipTick || game.mode === GameMode.GameOver) return;
    const iter = texts.iter();
    while (iter.next()) {
        const [count, entities, positions, data] = iter.current;
        const ys = positions[Position.y];
        const lifetimes = data[DamageText.lifetime];
        const origins = data[DamageText.floatY];
        for (let i = 0; i < count; i++) {
            lifetimes[i] -= time.delta;
            if (lifetimes[i] <= 0) {
                commands.entity(entities[i] as Entity).despawn().submit();
            } else {
                ys[i] = origins[i] + (0.7 - lifetimes[i]) * 40;
            }
        }
    }
}

function processLevelUp(
    game: Mut<GameState>,
    random: RandomService,
    input: InputService,
): void {
    if (game.skipTick) return;

    if (game.mode === GameMode.LevelUp) {
        const choice = input.consumeUpgrade();
        if (choice < 0 || choice > 2) return;
        const selected = game.upgradeOptions[choice];
        if (selected === undefined) return;
        applyUpgrade(game, selected);

        game.rebuildShooter = 1;
        game.mode = GameMode.Playing;
        game.skipTick = 1;
        game.upgradeOptions = [];
        return;
    }

    if (game.mode !== GameMode.Playing || game.xp < game.xpToNext) return;
    game.xp -= game.xpToNext;
    game.level++;
    game.xpToNext = Math.floor(50 + game.level * 45 + game.level * game.level * 5);
    game.upgradeOptions = pickUpgrades(random, 3);
    game.mode = GameMode.LevelUp;
}

function applyUpgrade(game: Mut<GameState>, upgrade: UpgradeType): void {
    switch (upgrade) {
        case UpgradeType.Damage: game.damageLevel++; break;
        case UpgradeType.AttackSpeed: game.attackSpeedLevel++; break;
        case UpgradeType.Scatter: game.scatterLevel++; break;
        case UpgradeType.Split: game.splitLevel++; break;
        case UpgradeType.Ricochet: game.ricochetLevel++; break;
        case UpgradeType.Burst: game.burstLevel++; break;
        case UpgradeType.CritChance: game.critChanceLevel++; break;
        case UpgradeType.CritDamage: game.critDamageLevel++; break;
        case UpgradeType.FlatDamage: game.flatDamageLevel++; break;
        case UpgradeType.DamageMultiplier: game.damageMultiplierLevel++; break;
    }
}
