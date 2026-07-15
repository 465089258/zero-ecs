import {
    CommandService,
    RandomService,
    TimeState,
    type Entity,
    type Mut,
    type QueryOf,
} from "zero-ecs-lib";
import {
    Bullet,
    BulletType,
    DamageText,
    ExpOrb,
    Position,
    Shooter,
    Velocity,
    Wall,
    Zombie,
} from "./components";
import {
    BulletQuery,
    DamageTextQuery,
    ExpOrbQuery,
    GameEntityQuery,
    ShooterQuery,
    WallQuery,
    ZombieQuery,
} from "./queries";
import { GameConfigResource } from "./resources";
import { InputService } from "./services/input-service";
import { RendererService } from "./services/renderer-service";
import { SpawnService } from "./services/spawn-service";
import {
    GameMode,
    GameState,
    UpgradeType,
} from "./states";

type Shooters = QueryOf<typeof ShooterQuery>;
type Bullets = QueryOf<typeof BulletQuery>;
type Zombies = QueryOf<typeof ZombieQuery>;
type Walls = QueryOf<typeof WallQuery>;
type ExpOrbs = QueryOf<typeof ExpOrbQuery>;
type DamageTexts = QueryOf<typeof DamageTextQuery>;
type GameEntities = QueryOf<typeof GameEntityQuery>;

const ALL_UPGRADES: UpgradeType[] = [
    UpgradeType.Damage,
    UpgradeType.AttackSpeed,
    UpgradeType.Scatter,
    UpgradeType.Split,
    UpgradeType.Ricochet,
    UpgradeType.Burst,
    UpgradeType.CritChance,
    UpgradeType.CritDamage,
    UpgradeType.FlatDamage,
    UpgradeType.DamageMultiplier,
];

export function startupGameSystem(
    spawn: SpawnService,
    renderer: RendererService,
    game: Mut<GameState>,
    shooter: Shooters,
    bullets: Bullets,
    zombies: Zombies,
    walls: Walls,
    expOrbs: ExpOrbs,
    damageTexts: DamageTexts,
): void {
    renderer.bind(shooter, bullets, zombies, walls, expOrbs, damageTexts);
    game.skipTick = 1;
    game.xpToNext = 50;
    spawn.spawnGame();
}

export function restartSystem(
    input: InputService,
    commands: CommandService,
    spawn: SpawnService,
    game: Mut<GameState>,
    entities: GameEntities,
): void {
    if (!input.consumeRestart()) return;
    const iter = entities.iter();
    while (iter.next()) {
        const [count, ids] = iter.current;
        for (let i = 0; i < count; i++) commands.entity(ids[i] as Entity).despawn().submit();
    }
    game.score = 0;
    game.wave = 0;
    game.waveTimer = 0;
    game.spawnQueue = 0;
    game.spawnTimer = 0;
    game.xp = 0;
    game.xpToNext = 50;
    game.level = 0;
    game.zombies = 0;
    game.bullets = 0;
    game.expOrbs = 0;
    game.entities = 0;
    game.damageLevel = 1;
    game.attackSpeedLevel = 1;
    game.scatterLevel = 1;
    game.splitLevel = 0;
    game.ricochetLevel = 1;
    game.burstLevel = 1;
    game.critChanceLevel = 1;
    game.critDamageLevel = 1;
    game.flatDamageLevel = 1;
    game.damageMultiplierLevel = 1;
    game.baseZombieCount = 1;
    game.inHorde = false;
    game.waveZombieTotal = 0;
    game.wallHp = 0;
    game.wallMaxHp = 0;
    game.mode = GameMode.Playing;
    game.skipTick = 1;
    game.upgradeOptions = [];
    pendingBaseGrowth = false;
    spawn.spawnGame();
}

export function shooterFireSystem(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    random: RandomService,
    spawn: SpawnService,
    game: Readonly<GameState>,
    shooter: Shooters,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = shooter.iter();
    while (iter.next()) {
        const [count, , positions, shooters] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const fireTimers = shooters[Shooter.fireTimer];
        const fireIntervals = shooters[Shooter.fireInterval];
        const damages = shooters[Shooter.damage];
        const critChances = shooters[Shooter.critChance];
        const critMults = shooters[Shooter.critMult];
        const scatters = shooters[Shooter.scatter];
        const splits = shooters[Shooter.split];
        const ricochets = shooters[Shooter.ricochet];
        const bursts = shooters[Shooter.burst];
        const burstCooldowns = shooters[Shooter.burstCooldown];
        const burstLefts = shooters[Shooter.burstLeft];

        for (let i = 0; i < count; i++) {
            // Handle burst sub-ticks
            if (burstLefts[i] > 0) {
                burstCooldowns[i] -= time.delta;
                if (burstCooldowns[i] <= 0) {
                    fireBulletGroup(
                        xs[i], ys[i],
                        damages[i], critChances[i], critMults[i],
                        scatters[i], splits[i], ricochets[i],
                        spawn, zombies, random,
                    );
                    burstLefts[i]--;
                    if (burstLefts[i] > 0) {
                        burstCooldowns[i] = fireIntervals[i] / 3 / bursts[i];
                    }
                }
            }

            // Main fire timer
            if (burstLefts[i] > 0) continue;
            fireTimers[i] -= time.delta;
            if (fireTimers[i] > 0) continue;

            fireTimers[i] = fireIntervals[i];

            const burstCount = bursts[i];
            const scatterCount = scatters[i];
            const splitCount = splits[i];
            const ricochetCount = ricochets[i];

            // Fire first bullet immediately
            fireBulletGroup(
                xs[i], ys[i],
                damages[i], critChances[i], critMults[i],
                scatterCount, splitCount, ricochetCount,
                spawn, zombies, random,
            );

            // Queue remaining burst bullets
            if (burstCount > 1) {
                burstLefts[i] = burstCount - 1;
                burstCooldowns[i] = fireIntervals[i] / 3 / burstCount;
            }
        }
    }
}

function fireBulletGroup(
    sx: number, sy: number,
    damage: number, critChance: number, critMult: number,
    scatterCount: number, splitCount: number, ricochetCount: number,
    spawn: SpawnService, zombies: Zombies, random: RandomService,
): void {
    const baseAngle = findNearestZombieAngle(sx, sy, zombies);
    for (let s = 0; s < scatterCount; s++) {
        let angle = baseAngle;
        if (scatterCount > 1) {
            const spread = 0.12;
            angle += spread * (s - (scatterCount - 1) * 0.5);
        }
        const variance = random.float(0.9, 1.1);
        const dmg = (critChance > random.float(0, 1) ? damage * critMult : damage) * variance;
        spawn.spawnBullet(sx + 12, sy + s * 4 - scatterCount * 2, angle, dmg, splitCount, ricochetCount);
    }
}

export function moveBulletsSystem(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: CommandService,
    bullets: Bullets,
): void {
    if (game.skipTick || game.mode === GameMode.GameOver) return;
    if (game.mode === GameMode.LevelUp) return;
    const wallInset = 10;
    const iter = bullets.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, bulletData] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const vxs = velocities[Velocity.x];
        const vys = velocities[Velocity.y];
        const ricochetCounts = bulletData[Bullet.ricochetCount];
        const lifetimes = bulletData[Bullet.lifetime];
        const active = bulletData[Bullet.active];
        const radii = bulletData[Bullet.radius];

        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            let x = xs[i] + vxs[i] * time.delta;
            let y = ys[i] + vys[i] * time.delta;
            lifetimes[i] -= time.delta;

            // Ricochet off map boundaries
            let bounced = false;
            const r = radii[i];
            if (x - r < wallInset) { x = wallInset + r; vxs[i] = Math.abs(vxs[i]); bounced = true; }
            else if (x + r > config.width - wallInset) { x = config.width - wallInset - r; vxs[i] = -Math.abs(vxs[i]); bounced = true; }
            if (y - r < wallInset) { y = wallInset + r; vys[i] = Math.abs(vys[i]); bounced = true; }
            else if (y + r > config.height - wallInset) { y = config.height - wallInset - r; vys[i] = -Math.abs(vys[i]); bounced = true; }

            if (bounced) {
                if (ricochetCounts[i] > 0) {
                    ricochetCounts[i]--;
                    lifetimes[i] += 0.5;
                } else {
                    active[i] = 0;
                    commands.entity(entities[i] as Entity).despawn().submit();
                    continue;
                }
            }

            xs[i] = x;
            ys[i] = y;

            if (lifetimes[i] <= 0) {
                active[i] = 0;
                commands.entity(entities[i] as Entity).despawn().submit();
            }
        }
    }
}

export function moveZombiesSystem(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: CommandService,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = zombies.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, zombieData] = iter.current;
        const xs = positions[Position.x];
        const vxs = velocities[Velocity.x];
        const active = zombieData[Zombie.active];

        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            xs[i] += vxs[i] * time.delta;

            if (xs[i] <= config.wallX + config.wallHalfWidth + config.zombieRadius) {
                xs[i] = config.wallX + config.wallHalfWidth + config.zombieRadius;
                vxs[i] = 0;
            }
        }
    }
}

export function zombieWallCollisionSystem(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    commands: CommandService,
    zombies: Zombies,
    walls: Walls,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    let wallEntity: Entity | null = null;
    let wallHp = 0;
    let wallMaxHp = 0;

    const wallIter = walls.iter();
    while (wallIter.next()) {
        const [wCount, wEntities, , wData] = wallIter.current;
        if (wCount > 0) {
            wallEntity = wEntities[0] as Entity;
            wallHp = wData[Wall.hp][0];
            wallMaxHp = wData[Wall.maxHp][0];
        }
    }
    if (wallEntity === null || wallHp <= 0) return;

    let currentHp = wallHp;
    const zIter = zombies.iter();
    while (zIter.next()) {
        const [count, , zPositions, , zData] = zIter.current;
        const zXs = zPositions[Position.x];
        const zActive = zData[Zombie.active];
        const zDamages = zData[Zombie.damage];

        for (let i = 0; i < count; i++) {
            if (zActive[i] === 0) continue;
            if (zXs[i] <= config.wallX + config.wallHalfWidth + config.zombieRadius + 1) {
                currentHp -= zDamages[i] * (1 / 120);
            }
        }
    }

    // Update wall HP in the component data
    const wIter2 = walls.iter();
    while (wIter2.next()) {
        const [, , , wData] = wIter2.current;
        wData[Wall.hp][0] = Math.max(0, currentHp);
    }

    if (currentHp <= 0) {
        commands.entity(wallEntity).despawn().submit();
        game.mode = GameMode.GameOver;
    }

    game.wallHp = Math.ceil(Math.max(0, currentHp));
    game.wallMaxHp = wallMaxHp;
}

export function bulletZombieCollisionSystem(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    random: RandomService,
    commands: CommandService,
    spawn: SpawnService,
    bullets: Bullets,
    zombies: Zombies,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    const zIter = zombies.iter();
    while (zIter.next()) {
        const [zCount, zEntities, zPositions, , zData] = zIter.current;
        const zXs = zPositions[Position.x];
        const zYs = zPositions[Position.y];
        const zHp = zData[Zombie.hp];
        const zXp = zData[Zombie.xp];
        const zActive = zData[Zombie.active];

        for (let zi = 0; zi < zCount; zi++) {
            if (zActive[zi] === 0) continue;
            const zx = zXs[zi];
            const zy = zYs[zi];
            const zr = config.zombieRadius;

            const bIter = bullets.iter();
            let bulletHit = false;
            while (!bulletHit && bIter.next()) {
                const [bCount, bEntities, bPositions, bVelocities, bData] = bIter.current;
                const bXs = bPositions[Position.x];
                const bYs = bPositions[Position.y];
                const bActive = bData[Bullet.active];
                const bDamage = bData[Bullet.damage];
                const bSplitCount = bData[Bullet.splitCount];
                const bRicochetCounts = bData[Bullet.ricochetCount];

                for (let bi = 0; bi < bCount; bi++) {
                    if (bActive[bi] === 0) continue;
                    const bx = bXs[bi];
                    const by = bYs[bi];
                    const br = bData[Bullet.radius][bi];
                    const dx = bx - zx;
                    const dy = by - zy;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > zr + br) continue;

                    // Hit! Original bullet always deals damage
                    zHp[zi] -= bDamage[bi];
                    game.score += 10;
                    spawn.spawnDamageText(bx, by, Math.round(bDamage[bi]));

                    // Handle split: spawn child bullets along bullet trajectory
                    if (bSplitCount[bi] > 0) {
                        const bulletAngle = Math.atan2(
                            bVelocities[Velocity.y][bi],
                            bVelocities[Velocity.x][bi],
                        );
                        const totalDeg = 30;
                        const totalRad = (totalDeg * Math.PI) / 180;
                        const splitCount = bSplitCount[bi];
                        // If spread × count exceeds 360°, use equal division
                        const spread = (totalRad * splitCount > Math.PI * 2)
                            ? (Math.PI * 2) / splitCount
                            : totalRad / Math.max(1, splitCount - 1);

                        const halfFan = (spread * (splitCount - 1)) / 2;
                        // Spawn outside the trigger zombie's hitbox to avoid re-hitting
                        const spawnDist = zr + 8;
                        for (let s = 0; s < splitCount; s++) {
                            const angle = bulletAngle - halfFan + spread * s;
                            const sx = bx + Math.cos(angle) * spawnDist;
                            const sy = by + Math.sin(angle) * spawnDist;
                            spawn.spawnBullet(sx, sy, angle, bDamage[bi] * 0.5, 0, bRicochetCounts[bi]);
                        }
                    }

                    // Handle ricochet: bounce the original bullet toward nearest other zombie
                    if (bRicochetCounts[bi] > 0) {
                        bRicochetCounts[bi]--;
                        bData[Bullet.lifetime][bi] += 0.5;
                        const ricochetAngle = findRicochetTarget(
                            bx, by, zXs, zYs, zActive, zCount,
                        );
                        if (ricochetAngle !== null) {
                            // Redirect the bullet
                            const speed = bData[Bullet.speed][bi];
                            bVelocities[Velocity.x][bi] = Math.cos(ricochetAngle) * speed;
                            bVelocities[Velocity.y][bi] = Math.sin(ricochetAngle) * speed;
                        }
                    } else {
                        // No ricochet left: destroy the bullet
                        bActive[bi] = 0;
                        commands.entity(bEntities[bi] as Entity).despawn().submit();
                    }

                    // Zombie killed?
                    if (zHp[zi] <= 0) {
                        zActive[zi] = 0;
                        commands.entity(zEntities[zi] as Entity).despawn().submit();
                        spawn.spawnExpOrb(zx, zy, zXp[zi]);
                        game.score += 50;
                    }

                    bulletHit = true;
                    break;
                }
            }
        }
    }
}

function findRicochetTarget(
    fromX: number, fromY: number,
    zXs: Float32Array, zYs: Float32Array, zActive: Uint8Array,
    zCount: number,
): number | null {
    let closestDist = Infinity;
    let closestAngle = 0;
    for (let i = 0; i < zCount; i++) {
        if (zActive[i] === 0) continue;
        const dx = zXs[i] - fromX;
        const dy = zYs[i] - fromY;
        const dist = dx * dx + dy * dy;
        if (dist < closestDist && dist > 1) {
            closestDist = dist;
            closestAngle = Math.atan2(dy, dx);
        }
    }
    if (closestDist === Infinity) return null;
    return closestAngle;
}

export function expCollectSystem(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    commands: CommandService,
    expOrbs: ExpOrbs,
    shooter: Shooters,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    // Read shooter position
    let shooterX = config.shooterX;
    let shooterY = config.shooterY;
    const sIter = shooter.iter();
    while (sIter.next()) {
        const [sCount, , sPositions] = sIter.current;
        if (sCount > 0) {
            shooterX = sPositions[Position.x][0];
            shooterY = sPositions[Position.y][0];
        }
    }

    const magnetSpeed = 420;
    const collectRange = 18;
    const iter = expOrbs.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, orbData] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const vxs = velocities[Velocity.x];
        const vys = velocities[Velocity.y];
        const active = orbData[ExpOrb.active];
        const values = orbData[ExpOrb.value];

        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            const dx = shooterX - xs[i];
            const dy = shooterY - ys[i];
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < collectRange) {
                active[i] = 0;
                commands.entity(entities[i] as Entity).despawn().submit();
                game.xp += values[i];
                continue;
            }

            // Magnet toward shooter
            const speed = magnetSpeed + dist * 0.3; // faster when farther
            vxs[i] = (dx / dist) * speed;
            vys[i] = (dy / dist) * speed;
            xs[i] += vxs[i] * (1 / 120);
            ys[i] += vys[i] * (1 / 120);
        }
    }
}

export function spawnSystem(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Mut<GameState>,
    random: RandomService,
    spawn: SpawnService,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;

    // Init first wave
    if (game.wave === 0) {
        game.wave = 1;
        game.waveTimer = config.waveInterval;
        game.waveDuration = config.waveInterval;
    }

    // Horde phase: wait until all zombies are dead
    if (game.inHorde) {
        if (game.zombies === 0) {
            game.inHorde = false;
            game.wave++;
            game.waveTimer = Math.max(4, config.waveInterval - game.wave * 0.08);
            game.waveDuration = game.waveTimer;
            game.level++;
            game.xpToNext = Math.floor(50 + game.level * 45 + game.level * game.level * 5);
            game.upgradeOptions = pickUpgrades(random, 3);
            game.mode = GameMode.LevelUp;
        }
        return;
    }

    // Normal wave: timer counts down
    game.waveTimer -= time.delta;

    // Continuous zombie spawning during wave
    game.spawnTimer -= time.delta;
    if (game.spawnTimer <= 0 && game.zombies < config.maxZombies) {
        const minDelay = Math.max(0.15, config.spawnDelayMin - game.wave * 0.005);
        const maxDelay = Math.max(0.4, config.spawnDelayMax - game.wave * 0.01);
        game.spawnTimer = random.float(minDelay, maxDelay);
        spawn.spawnZombie(game.wave);
    }

    // Timer expired → trigger horde
    if (game.waveTimer <= 0) {
        game.inHorde = true;
        const isBossWave = game.wave % config.bossWaveInterval === 0;
        let hordeCount = game.baseZombieCount * 3 + game.wave * 3;
        if (isBossWave) {
            hordeCount = Math.floor(hordeCount * config.bossWaveMultiplier);
            scheduleBaseGrowth(game, config);
        }
        hordeCount = Math.min(hordeCount, config.maxZombies - game.zombies);
        game.waveZombieTotal = game.zombies + hordeCount;

        const yMin = config.zombieSpawnYMin + 20;
        const yMax = config.zombieSpawnYMax - 20;
        for (let i = 0; i < hordeCount; i++) {
            const x = config.zombieSpawnX - random.float(0, 60);
            const y = hordeCount > 1
                ? yMin + (yMax - yMin) * (i / (hordeCount - 1)) + random.float(-15, 15)
                : yMin + (yMax - yMin) * 0.5;
            spawn.spawnZombieAt(game.wave + 2, x, y);
        }
    }
}

// Deferred base growth: applies when current boss wave's spawn queue is empty
let pendingBaseGrowth = false;
function scheduleBaseGrowth(game: Mut<GameState>, config: Readonly<GameConfigResource>): void {
    pendingBaseGrowth = true;
}
// Called in statisticsSystem to apply growth after boss wave finishes spawning
function applyBaseGrowth(game: Mut<GameState>, config: Readonly<GameConfigResource>): void {
    if (!pendingBaseGrowth) return;
    if (game.spawnQueue > 0 || game.zombies > game.baseZombieCount * 0.5) return;
    game.baseZombieCount += config.baseZombieGrowth;
    pendingBaseGrowth = false;
}

export function levelUpSystem(
    game: Mut<GameState>,
    random: RandomService,
    input: InputService,
    spawn: SpawnService,
    commands: CommandService,
    entities: GameEntities,
    shooter: Shooters,
): void {
    if (game.skipTick) return;

    if (game.mode === GameMode.LevelUp) {
        const choice = input.consumeUpgrade();
        if (choice < 0 || choice > 2) return;
        const selected = game.upgradeOptions[choice];
        if (selected === undefined) return;

        applyUpgrade(game, selected);

        // Rebuild shooter with new stats
        const sIter = shooter.iter();
        while (sIter.next()) {
            const [sCount, sEntities] = sIter.current;
            for (let i = 0; i < sCount; i++) commands.entity(sEntities[i] as Entity).despawn().submit();
        }
        spawn.spawnShooter();

        game.mode = GameMode.Playing;
        game.skipTick = 1;
        game.upgradeOptions = [];
        return;
    }

    if (game.mode !== GameMode.Playing) return;

    if (game.xp >= game.xpToNext) {
        game.xp -= game.xpToNext;
        game.level++;
        game.xpToNext = Math.floor(50 + game.level * 45 + game.level * game.level * 5);

        const options = pickUpgrades(random, 3);
        game.upgradeOptions = options;
        game.mode = GameMode.LevelUp;
    }
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

function pickUpgrades(random: RandomService, count: number): UpgradeType[] {
    const pool = [...ALL_UPGRADES];
    const result: UpgradeType[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = random.int(0, pool.length - 1);
        result.push(pool[idx]);
        pool.splice(idx, 1);
    }
    return result;
}

export function statisticsSystem(
    game: Mut<GameState>,
    config: Readonly<GameConfigResource>,
    bullets: Bullets,
    zombies: Zombies,
    expOrbs: ExpOrbs,
    entities: GameEntities,
): void {
    game.bullets = countActiveBullets(bullets);
    game.zombies = countActiveZombies(zombies);
    game.expOrbs = countActiveExpOrbs(expOrbs);
    game.entities = countEntities(entities);

    if (game.wallMaxHp === 0) game.wallMaxHp = 500;

    // Apply base zombie growth after boss wave finishes spawning
    applyBaseGrowth(game, config);

    game.skipTick = 0;
}

function countActiveBullets(query: Bullets): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , , bullets] = iter.current;
        const active = bullets[Bullet.active];
        for (let i = 0; i < count; i++) total += active[i] !== 0 ? 1 : 0;
    }
    return total;
}

function countActiveZombies(query: Zombies): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , , zombies] = iter.current;
        const active = zombies[Zombie.active];
        for (let i = 0; i < count; i++) total += active[i] !== 0 ? 1 : 0;
    }
    return total;
}

function countActiveExpOrbs(query: ExpOrbs): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , , orbs] = iter.current;
        const active = orbs[ExpOrb.active];
        for (let i = 0; i < count; i++) total += active[i] !== 0 ? 1 : 0;
    }
    return total;
}

function countEntities(query: GameEntities): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) total += iter.current[0];
    return total;
}

function findNearestZombieAngle(shooterX: number, shooterY: number, zombies: Zombies): number {
    let closestDist = Infinity;
    let closestAngle = 0; // default: straight right
    const zIter = zombies.iter();
    while (zIter.next()) {
        const [zCount, , zPositions, , zData] = zIter.current;
        const zXs = zPositions[Position.x];
        const zYs = zPositions[Position.y];
        const zActive = zData[Zombie.active];
        for (let i = 0; i < zCount; i++) {
            if (zActive[i] === 0) continue;
            const dx = zXs[i] - shooterX;
            const dy = zYs[i] - shooterY;
            const dist = dx * dx + dy * dy;
            if (dist < closestDist) {
                closestDist = dist;
                closestAngle = Math.atan2(dy, dx);
            }
        }
    }
    return closestAngle;
}

export function damageTextUpdateSystem(
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: CommandService,
    texts: DamageTexts,
): void {
    if (game.skipTick || game.mode === GameMode.GameOver) return;
    const iter = texts.iter();
    while (iter.next()) {
        const [count, entities, positions, textData] = iter.current;
        const ys = positions[Position.y];
        const lifetimes = textData[DamageText.lifetime];
        const floats = textData[DamageText.floatY];

        for (let i = 0; i < count; i++) {
            lifetimes[i] -= time.delta;
            if (lifetimes[i] <= 0) {
                commands.entity(entities[i] as Entity).despawn().submit();
                continue;
            }
            // Float upward
            ys[i] = floats[i] + (0.7 - lifetimes[i]) * 40;
        }
    }
}
