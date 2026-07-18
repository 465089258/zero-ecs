// ============================================================
// OOP Zombie Shooter — performance comparison vs ECS
// ============================================================

import "./styles.css";

// ---- Math helpers ----
const rand = (min: number, max: number): number => Math.random() * (max - min) + min;
const randInt = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

// ---- Config (mirrors ECS GameConfigResource) ----
const CONFIG = {
    width: 960,
    height: 640,
    shooterX: 70,
    shooterY: 320,
    shooterFireInterval: 2.0,
    shooterMinFireInterval: 0.15,
    bulletBaseDamage: 5,
    bulletSpeed: 800,
    bulletRadius: 5,
    bulletLifetime: 1.5,
    critChance: 0.05,
    critMult: 1.5,
    scatterBase: 1,
    splitBase: 2,
    ricochetBase: 0,
    burstBase: 1,
    // Zombie
    zombieBaseHp: 10,
    zombieBaseSpeed: 5,
    zombieMaxSpeed: 30,
    zombieBaseXp: 100,
    zombieDamageBase: 3,
    zombieRadius: 20,
    zombieSpawnX: 920,
    zombieSpawnYMin: 80,
    zombieSpawnYMax: 560,
    // Wave
    restTime: 3.0,
    zombiePerWaveGrowth: 2,
    spawnDelayMin: 1.5,
    spawnDelayMax: 4.0,
    bossWaveInterval: 5,
    bossWaveMultiplier: 1.5,
    baseZombieGrowth: 2,
    maxZombies: 80,
    // Wall
    wallX: 210,
    wallY: 320,
    wallHalfWidth: 12,
    wallHalfHeight: 260,
    wallInitialHp: 2000,
    // XP
    xpBase: 25,
    expOrbSpeed: 80,
    expOrbRadius: 6,
    magnetSpeed: 420,
    collectRange: 18,
    // Upgrade
    upgradeDamageGrowth: 0.25,
    upgradeAttackSpeed: 0.25,
    upgradeCritChanceBonus: 0.15,
    upgradeCritDamageBonus: 0.25,
    upgradeScatter: 1,
    upgradeSplit: 1,
    upgradeRicochet: 1,
    upgradeBurst: 1,
    upgradeFlatDamage: 8,
    upgradeDamageMultiplier: 0.25,
};

enum GameMode { Playing, LevelUp, GameOver }
enum WavePhase { Spawning, Fighting, Horde, Resting }
enum UpgradeType {
    Damage, AttackSpeed, Scatter, Split, Ricochet, Burst,
    CritChance, CritDamage, FlatDamage, DamageMultiplier,
}

const UPGRADE_NAMES: string[] = [
    "攻击力", "攻速", "散射数量", "子弹分裂", "子弹弹射", "连射数量",
    "暴击提高", "暴击伤害", "伤害增加", "伤害总增",
];

const UPGRADE_DESCRIPTIONS: Record<number, (level: number) => string> = {
    [UpgradeType.Damage]: (l: number) =>
        `攻击力 +25% (${(5 * (1 + l * 0.15)).toFixed(1)}dmg, Lv.${l})`,
    [UpgradeType.AttackSpeed]: (l: number) =>
        `攻速 +25% (${(2 / (1 + l * 0.15)).toFixed(2)}s, Lv.${l})`,
    [UpgradeType.Scatter]: (l: number) => `散射箭 +1 (当前 Lv.${l})`,
    [UpgradeType.Split]: (l: number) =>
        `命中分裂 ${l === 0 ? 0 : l + 1}颗 (当前 Lv.${l})`,
    [UpgradeType.Ricochet]: (l: number) => `弹射次数 +1 (当前 Lv.${l})`,
    [UpgradeType.Burst]: (l: number) => `连射弹数 +1 (当前 Lv.${l})`,
    [UpgradeType.CritChance]: (l: number) =>
        `暴击率 +5% (${((0.05 * (1 + l * 0.05)) * 100).toFixed(1)}%, Lv.${l})`,
    [UpgradeType.CritDamage]: (l: number) =>
        `暴伤 +15% (×${(1.5 * (1 + l * 0.15)).toFixed(2)}, Lv.${l})`,
    [UpgradeType.FlatDamage]: (l: number) => `伤害 +8 (当前 Lv.${l})`,
    [UpgradeType.DamageMultiplier]: (l: number) =>
        `总伤害 ×${(1 + l * 0.15).toFixed(2)} (当前 Lv.${l})`,
};

function getLevelKey(upgrade: UpgradeType): keyof GameManager {
    switch (upgrade) {
        case UpgradeType.Damage: return "damageLevel";
        case UpgradeType.AttackSpeed: return "attackSpeedLevel";
        case UpgradeType.Scatter: return "scatterLevel";
        case UpgradeType.Split: return "splitLevel";
        case UpgradeType.Ricochet: return "ricochetLevel";
        case UpgradeType.Burst: return "burstLevel";
        case UpgradeType.CritChance: return "critChanceLevel";
        case UpgradeType.CritDamage: return "critDamageLevel";
        case UpgradeType.FlatDamage: return "flatDamageLevel";
        case UpgradeType.DamageMultiplier: return "damageMultiplierLevel";
    }
}

const ALL_UPGRADES: UpgradeType[] = [
    UpgradeType.Damage, UpgradeType.AttackSpeed, UpgradeType.Scatter,
    UpgradeType.Split, UpgradeType.Ricochet, UpgradeType.Burst,
    UpgradeType.CritChance, UpgradeType.CritDamage,
    UpgradeType.FlatDamage, UpgradeType.DamageMultiplier,
];

// ============== Game Objects ==============

abstract class GameObject {
    x = 0; y = 0;
    vx = 0; vy = 0;
    active = true;
    abstract update(dt: number, manager: GameManager): void;
    abstract draw(ctx: CanvasRenderingContext2D): void;
}

class Bullet extends GameObject {
    damage = 0; speed = 800; splitCount = 0;
    ricochetCount = 0; lifetime = 1.5; radius = 5;
    ignoreEntity = 0; isCrit = false;

    update(dt: number, _manager: GameManager): void {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.lifetime -= dt;
        let bounced = false;
        const r = this.radius;
        if (this.x - r < 10) { this.x = 10 + r; this.vx = Math.abs(this.vx); bounced = true; }
        else if (this.x + r > CONFIG.width - 10) { this.x = CONFIG.width - 10 - r; this.vx = -Math.abs(this.vx); bounced = true; }
        if (this.y - r < 10) { this.y = 10 + r; this.vy = Math.abs(this.vy); bounced = true; }
        else if (this.y + r > CONFIG.height - 10) { this.y = CONFIG.height - 10 - r; this.vy = -Math.abs(this.vy); bounced = true; }
        if (bounced) {
            if (this.ricochetCount > 0) { this.ricochetCount--; this.lifetime += 0.5; this.ignoreEntity = 0; }
            else this.active = false;
        }
        if (this.lifetime <= 0) this.active = false;
    }
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = "#ffe082"; ctx.shadowColor = "#ffe082"; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Zombie extends GameObject {
    static nextId = 1;
    id: number;
    hp = 10; maxHp = 10; speed = 20; xp = 20; damage = 3; reduction = 0;
    constructor() { super(); this.id = Zombie.nextId++; }
    update(dt: number, _manager: GameManager): void {
        this.x += this.vx * dt;
        if (this.x <= CONFIG.wallX + CONFIG.wallHalfWidth + CONFIG.zombieRadius) {
            this.x = CONFIG.wallX + CONFIG.wallHalfWidth + CONFIG.zombieRadius;
            this.vx = 0;
        }
    }
    draw(ctx: CanvasRenderingContext2D): void {
        const health = this.hp / this.maxHp;
        const halfW = 12, halfH = 16;
        const bodyColor = health < 0.3 ? "#ef5350" : "#66bb6a";
        ctx.fillStyle = bodyColor; ctx.shadowColor = bodyColor; ctx.shadowBlur = 6;
        ctx.fillRect(this.x - halfW, this.y - halfH, halfW * 2, halfH * 2);
        ctx.beginPath(); ctx.arc(this.x, this.y - halfH - 3, 8, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.fillRect(this.x - 4, this.y - halfH - 6, 3, 3);
        ctx.fillRect(this.x + 1, this.y - halfH - 6, 3, 3);
        ctx.fillStyle = "#000";
        ctx.fillRect(this.x - 3, this.y - halfH - 5, 2, 2);
        ctx.fillRect(this.x + 2, this.y - halfH - 5, 2, 2);
        const barW = halfW * 2, barH = 4, barY = this.y - halfH - 16;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(this.x - barW / 2, barY, barW, barH);
        ctx.fillStyle = health > 0.5 ? "#66bb6a" : health > 0.25 ? "#ffa726" : "#ef5350";
        ctx.fillRect(this.x - barW / 2, barY, barW * health, barH);
    }
}

class Shooter extends GameObject {
    fireTimer = 0; fireInterval = 2; damage = 5;
    critChance = 0.05; critMult = 1.5; scatter = 1;
    split = 0; ricochet = 0; burst = 1;
    burstCooldown = 0; burstLeft = 0;

    update(_dt: number, _manager: GameManager): void { }
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = "#4fc3f7"; ctx.shadowColor = "#4fc3f7"; ctx.shadowBlur = 12;
        ctx.fillRect(this.x - 8, this.y - 14, 16, 28);
        ctx.beginPath(); ctx.arc(this.x, this.y - 20, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x + 10, this.y, 14, -Math.PI * 0.45, Math.PI * 0.45); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(this.x + 10, this.y - 10);
        ctx.lineTo(this.x + 24, this.y); ctx.lineTo(this.x + 10, this.y + 10); ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

class ExpOrb extends GameObject {
    value = 0; radius = 6;
    update(dt: number, manager: GameManager): void {
        const sh = manager.shooter;
        const dx = sh.x - this.x, dy = sh.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.collectRange) { this.active = false; manager.xp += this.value; return; }
        const speed = CONFIG.magnetSpeed + dist * 0.3;
        this.vx = (dx / dist) * speed; this.vy = (dy / dist) * speed;
        this.x += this.vx * dt; this.y += this.vy * dt;
    }
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = "rgba(186, 104, 200, 0.2)";
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ba68c8"; ctx.shadowColor = "#ba68c8"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff"; ctx.font = "bold 7px monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("XP", this.x, this.y);
    }
}

class Wall extends GameObject {
    hp = 2000; maxHp = 2000;
    update(_dt: number, _manager: GameManager): void { }
    draw(ctx: CanvasRenderingContext2D): void {
        const health = this.hp / this.maxHp;
        const halfW = CONFIG.wallHalfWidth, halfH = CONFIG.wallHalfHeight;
        const x = this.x, y = this.y;
        const color = health < 0.3 ? "#ff8a65" : "#90a4ae";
        ctx.fillStyle = color;
        ctx.fillRect(x - halfW, y - halfH, halfW * 2, halfH * 2);
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1;
        const brickH = 12;
        ctx.beginPath();
        for (let row = y - halfH; row < y + halfH; row += brickH) {
            ctx.moveTo(x - halfW, row); ctx.lineTo(x + halfW, row);
            const off = Math.floor((row - y + halfH) / brickH) % 2 === 0 ? 0 : halfW * 0.5;
            for (let col = x - halfW + off; col < x + halfW; col += halfW) {
                ctx.moveTo(col, row); ctx.lineTo(col, row + brickH);
            }
        }
        ctx.stroke();
        if (health < 0.6) {
            ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x - halfW * 0.7, y - halfH * 0.8);
            ctx.lineTo(x - halfW * 0.2, y);
            ctx.lineTo(x + halfW * 0.1, y + halfH * 0.3);
            ctx.stroke();
            if (health < 0.3) {
                ctx.beginPath();
                ctx.moveTo(x + halfW * 0.6, y - halfH * 0.5);
                ctx.lineTo(x + halfW * 0.3, y);
                ctx.lineTo(x - halfW * 0.1, y + halfH * 0.5);
                ctx.stroke();
            }
        }
        const barW = halfW * 2, barH = 6, barY2 = y - halfH - 12;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x - barW / 2, barY2, barW, barH);
        ctx.fillStyle = health > 0.5 ? "#66bb6a" : health > 0.25 ? "#ffa726" : "#ef5350";
        ctx.fillRect(x - barW / 2, barY2, barW * health, barH);
        ctx.fillStyle = "#fff"; ctx.font = "9px monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText(`Wall ${Math.ceil(this.hp)}/${this.maxHp}`, x, barY2 - 2);
    }
}

class DamageText extends GameObject {
    value = 0; lifetime = 0.7; floatY = 0; isCrit = false;
    constructor(x: number, y: number, value: number, isCrit = false) {
        super(); this.x = x; this.floatY = y; this.value = value; this.isCrit = isCrit;
    }
    update(dt: number, _manager: GameManager): void {
        this.lifetime -= dt;
        if (this.lifetime <= 0) this.active = false;
        this.y = this.floatY + (0.7 - this.lifetime) * 40;
    }
    draw(ctx: CanvasRenderingContext2D): void {
        const alpha = Math.min(1, this.lifetime / 0.3);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.isCrit ? "#ff4444" : "#ffeb3b";
        ctx.font = this.isCrit ? "bold 16px monospace" : "bold 12px monospace";
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = this.isCrit ? 3 : 2;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        const text = Math.round(this.value).toString();
        ctx.strokeText(text, this.x, this.y); ctx.fillText(text, this.x, this.y);
        ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
}

// ============== Game Manager ==============

class GameManager {
    bullets: Bullet[] = []; zombies: Zombie[] = [];
    expOrbs: ExpOrb[] = []; damageTexts: DamageText[] = [];
    shooter: Shooter; wall: Wall;
    private _bg?: CanvasGradient;

    score = 0; wave = 0; waveBudget = 0; wavePhase = WavePhase.Spawning;
    restTimer = 0; isBossWave = false; spawnTimer = 0;
    xp = 0; xpToNext = 50; level = 0;
    mode = GameMode.Playing; skipTick = 0;
    baseZombieCount = 1;

    damageLevel = 1; attackSpeedLevel = 1; scatterLevel = 1;
    splitLevel = 0; ricochetLevel = 1; burstLevel = 1;
    critChanceLevel = 1; critDamageLevel = 1;
    flatDamageLevel = 1; damageMultiplierLevel = 1;
    upgradeOptions: UpgradeType[] = [];

    constructor() {
        this.shooter = new Shooter();
        this.shooter.x = CONFIG.shooterX; this.shooter.y = CONFIG.shooterY;
        this.wall = new Wall();
        this.wall.x = CONFIG.wallX; this.wall.y = CONFIG.wallY;
        this.wall.hp = CONFIG.wallInitialHp; this.wall.maxHp = CONFIG.wallInitialHp;
        this.rebuildShooter();
    }

    rebuildShooter(): void {
        const g = this;
        const attackBonus = (g.attackSpeedLevel - 1) * CONFIG.upgradeAttackSpeed;
        g.shooter.fireInterval = Math.max(CONFIG.shooterMinFireInterval, CONFIG.shooterFireInterval / (1 + attackBonus));
        const baseDamage = CONFIG.bulletBaseDamage * (1 + (g.damageLevel - 1) * CONFIG.upgradeDamageGrowth);
        const flatDamage = (g.flatDamageLevel - 1) * CONFIG.upgradeFlatDamage;
        const damageMultiplier = 1 + (g.damageMultiplierLevel - 1) * CONFIG.upgradeDamageMultiplier;
        g.shooter.damage = (baseDamage + flatDamage) * damageMultiplier;
        const critBonus = (g.critChanceLevel - 1) * CONFIG.upgradeCritChanceBonus;
        g.shooter.critChance = Math.min(CONFIG.critChance * (1 + critBonus), 0.95);
        const critDmgBonus = (g.critDamageLevel - 1) * CONFIG.upgradeCritDamageBonus;
        g.shooter.critMult = CONFIG.critMult * (1 + critDmgBonus);
        g.shooter.scatter = CONFIG.scatterBase + (g.scatterLevel - 1) * CONFIG.upgradeScatter;
        g.shooter.split = g.splitLevel === 0 ? 0 : g.splitLevel + 1;
        g.shooter.ricochet = CONFIG.ricochetBase + (g.ricochetLevel - 1) * CONFIG.upgradeRicochet;
        g.shooter.burst = CONFIG.burstBase + (g.burstLevel - 1) * CONFIG.upgradeBurst;
        g.shooter.burstCooldown = 0;
        g.shooter.burstLeft = 0;
    }

    zombieStats(wave: number) {
        return {
            hp: CONFIG.zombieBaseHp + wave * wave * 3 + wave * wave * wave * 0.04,
            speed: Math.min(CONFIG.zombieBaseSpeed + wave * 3 + wave * wave * 0.5, CONFIG.zombieMaxSpeed),
            xp: CONFIG.zombieBaseXp + wave * wave * 1.0,
            wallDamage: CONFIG.zombieDamageBase + wave * 0.3 + wave * wave * 0.005,
            reduction: Math.min(wave * 0.004, 0.4),
        };
    }

    spawnBullet(x: number, y: number, angle: number, damage: number, split: number, ricochet: number, ignoreEntity = 0, isCrit = false): void {
        const b = new Bullet();
        b.x = x; b.y = y;
        b.vx = Math.cos(angle) * CONFIG.bulletSpeed;
        b.vy = Math.sin(angle) * CONFIG.bulletSpeed;
        b.damage = damage; b.speed = CONFIG.bulletSpeed;
        b.splitCount = split; b.ricochetCount = ricochet;
        b.lifetime = CONFIG.bulletLifetime; b.radius = CONFIG.bulletRadius;
        b.ignoreEntity = ignoreEntity; b.isCrit = isCrit;
        this.bullets.push(b);
    }

    spawnZombie(wave: number, xx?: number, yy?: number): void {
        const s = this.zombieStats(wave);
        const z = new Zombie();
        z.x = xx ?? CONFIG.zombieSpawnX;
        z.y = yy ?? rand(CONFIG.zombieSpawnYMin, CONFIG.zombieSpawnYMax);
        z.vx = -s.speed; z.hp = s.hp; z.maxHp = s.hp;
        z.speed = s.speed; z.xp = s.xp; z.damage = s.wallDamage;
        z.reduction = s.reduction;
        this.zombies.push(z);
    }

    spawnExpOrb(x: number, y: number, value: number): void {
        const orb = new ExpOrb();
        orb.x = x; orb.y = y; orb.vx = -CONFIG.expOrbSpeed;
        orb.value = value; orb.radius = CONFIG.expOrbRadius;
        this.expOrbs.push(orb);
    }

    spawnDamageText(x: number, y: number, value: number, isCrit = false): void {
        this.damageTexts.push(new DamageText(x, y, value, isCrit));
    }

    findNearestZombieAngle(fx: number, fy: number): number {
        let closestDist = Infinity, closestAngle = 0;
        for (const z of this.zombies) {
            if (!z.active) continue;
            const dx = z.x - fx, dy = z.y - fy;
            const dist = dx * dx + dy * dy;
            if (dist < closestDist) { closestDist = dist; closestAngle = Math.atan2(dy, dx); }
        }
        return closestAngle;
    }

    findRicochetTarget(fx: number, fy: number, excludeId = 0): Zombie | null {
        let closestDist = Infinity, closest: Zombie | null = null;
        for (const z of this.zombies) {
            if (!z.active || z.id === excludeId) continue;
            const dx = z.x - fx, dy = z.y - fy;
            const dist = dx * dx + dy * dy;
            if (dist < closestDist && dist > 1) { closestDist = dist; closest = z; }
        }
        return closest;
    }

    pickUpgrades(count: number): UpgradeType[] {
        const pool = [...ALL_UPGRADES], result: UpgradeType[] = [];
        for (let i = 0; i < count && pool.length > 0; i++) {
            const idx = randInt(0, pool.length - 1);
            result.push(pool[idx]); pool.splice(idx, 1);
        }
        return result;
    }

    applyUpgrade(upgrade: UpgradeType): void {
        switch (upgrade) {
            case UpgradeType.Damage: this.damageLevel++; break;
            case UpgradeType.AttackSpeed: this.attackSpeedLevel++; break;
            case UpgradeType.Scatter: this.scatterLevel++; break;
            case UpgradeType.Split: this.splitLevel++; break;
            case UpgradeType.Ricochet: this.ricochetLevel++; break;
            case UpgradeType.Burst: this.burstLevel++; break;
            case UpgradeType.CritChance: this.critChanceLevel++; break;
            case UpgradeType.CritDamage: this.critDamageLevel++; break;
            case UpgradeType.FlatDamage: this.flatDamageLevel++; break;
            case UpgradeType.DamageMultiplier: this.damageMultiplierLevel++; break;
        }
        this.rebuildShooter();
    }

    startWave(): void {
        this.wave++;
        this.isBossWave = this.wave % CONFIG.bossWaveInterval === 0;
        this.waveBudget = this.baseZombieCount + this.wave * CONFIG.zombiePerWaveGrowth;
        this.wavePhase = WavePhase.Spawning;
    }

    update(dt: number): void {
        if (this.skipTick > 0) { this.skipTick = 0; return; }
        if (this.mode === GameMode.GameOver) return;
        if (this.mode === GameMode.LevelUp) return;

        if (this.wave === 0) this.startWave();

        // Shooter
        this.updateShooter(dt);

        // Update bullets / zombies / orbs / texts
        for (const b of this.bullets) if (b.active) b.update(dt, this);
        for (const z of this.zombies) if (z.active) z.update(dt, this);
        this.updateCollisions();
        this.updateWallDamage(dt);
        for (const o of this.expOrbs) if (o.active) o.update(dt, this);
        for (const t of this.damageTexts) if (t.active) t.update(dt, this);

        // Level up check
        if (this.xp >= this.xpToNext) {
            this.xp -= this.xpToNext; this.level++;
            this.xpToNext = Math.floor(50 + this.level * 45 + this.level * this.level * 5);
            this.upgradeOptions = this.pickUpgrades(3);
            this.mode = GameMode.LevelUp;
        }

        // Wave phase logic
        switch (this.wavePhase) {
            case WavePhase.Spawning:
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0 && this.waveBudget > 0 && this.zombies.length < CONFIG.maxZombies) {
                    const minD = Math.max(0.15, CONFIG.spawnDelayMin - this.wave * 0.005);
                    const maxD = Math.max(0.4, CONFIG.spawnDelayMax - this.wave * 0.01);
                    this.spawnTimer = rand(minD, maxD);
                    const groupSize = Math.min(
                        Math.ceil(this.wave / 2), this.waveBudget, CONFIG.maxZombies - this.zombies.length,
                    );
                    for (let g = 0; g < groupSize; g++) { this.spawnZombie(this.wave); this.waveBudget--; }
                }
                if (this.waveBudget <= 0) this.wavePhase = WavePhase.Fighting;
                break;

            case WavePhase.Fighting:
                if (this.zombies.length === 0) {
                    if (this.isBossWave) {
                        const hordeCount = Math.round(this.waveBudget * CONFIG.bossWaveMultiplier) +
                            this.baseZombieCount + this.wave * CONFIG.zombiePerWaveGrowth;
                        const count = Math.min(hordeCount, CONFIG.maxZombies);
                        const yMin = CONFIG.zombieSpawnYMin + 20;
                        const yMax = CONFIG.zombieSpawnYMax - 20;
                        for (let i = 0; i < count; i++) {
                            const x = CONFIG.zombieSpawnX - rand(0, 60);
                            const y = count > 1
                                ? yMin + (yMax - yMin) * (i / (count - 1)) + rand(-15, 15)
                                : yMin + (yMax - yMin) * 0.5;
                            this.spawnZombie(this.wave + 2, x, y);
                        }
                        this.waveBudget = count;
                        this.wavePhase = WavePhase.Horde;
                    } else {
                        this.restTimer = CONFIG.restTime;
                        this.wavePhase = WavePhase.Resting;
                    }
                }
                break;

            case WavePhase.Horde:
                if (this.zombies.length === 0) {
                    this.level++;
                    this.xpToNext = Math.floor(50 + this.level * 45 + this.level * this.level * 5);
                    this.upgradeOptions = this.pickUpgrades(3);
                    this.mode = GameMode.LevelUp;
                    this.baseZombieCount += CONFIG.baseZombieGrowth;
                    this.restTimer = CONFIG.restTime;
                    this.wavePhase = WavePhase.Resting;
                }
                break;

            case WavePhase.Resting:
                this.restTimer -= dt;
                if (this.restTimer <= 0) this.startWave();
                break;
        }

        // Cleanup
        this.bullets = this.bullets.filter(b => b.active);
        this.zombies = this.zombies.filter(z => z.active);
        this.expOrbs = this.expOrbs.filter(o => o.active);
        this.damageTexts = this.damageTexts.filter(t => t.active);
    }

    updateShooter(dt: number): void {
        const sh = this.shooter;
        if (sh.burstLeft > 0) {
            sh.burstCooldown -= dt;
            if (sh.burstCooldown <= 0) {
                this.fireBurstBullet(); sh.burstLeft--;
                if (sh.burstLeft > 0) sh.burstCooldown = sh.fireInterval / 3 / sh.burst;
            }
        }
        if (sh.burstLeft > 0) return;
        sh.fireTimer -= dt;
        if (sh.fireTimer > 0) return;
        sh.fireTimer = sh.fireInterval;
        const baseAngle = this.findNearestZombieAngle(sh.x, sh.y);
        for (let s = 0; s < sh.scatter; s++) {
            let angle = baseAngle;
            if (sh.scatter > 1) angle += 0.12 * (s - (sh.scatter - 1) * 0.5);
            const variance = rand(0.9, 1.1);
            const crit = sh.critChance > Math.random();
            const dmg = (crit ? sh.damage * sh.critMult : sh.damage) * variance;
            this.spawnBullet(sh.x + 12, sh.y + s * 4 - sh.scatter * 2, angle, dmg, sh.split, sh.ricochet, 0, crit);
        }
        if (sh.burst > 1) { sh.burstLeft = sh.burst - 1; sh.burstCooldown = sh.fireInterval / 3 / sh.burst; }
    }

    fireBurstBullet(): void {
        const sh = this.shooter;
        const baseAngle = this.findNearestZombieAngle(sh.x, sh.y);
        for (let s = 0; s < sh.scatter; s++) {
            let angle = baseAngle;
            if (sh.scatter > 1) angle += 0.12 * (s - (sh.scatter - 1) * 0.5);
            const variance = rand(0.9, 1.1);
            const crit = sh.critChance > Math.random();
            const dmg = (crit ? sh.damage * sh.critMult : sh.damage) * variance;
            this.spawnBullet(sh.x + 12, sh.y + s * 4 - sh.scatter * 2, angle, dmg, sh.split, sh.ricochet, 0, crit);
        }
    }

    updateCollisions(): void {
        for (const z of this.zombies) {
            if (!z.active) continue;
            const zr = CONFIG.zombieRadius;
            let bulletHit = false;
            for (const b of this.bullets) {
                if (!b.active || bulletHit) break;
                if (b.ignoreEntity !== 0 && b.ignoreEntity === z.id) continue;
                const dx = b.x - z.x, dy = b.y - z.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > zr + b.radius) continue;

                bulletHit = true;
                const actualDmg = b.damage * (1 - z.reduction);
                z.hp -= actualDmg;
                this.score += 10;
                this.spawnDamageText(b.x, b.y, Math.round(actualDmg), b.isCrit);

                if (b.splitCount > 0) {
                    // Mother destroyed, child bullets spread uniformly
                    const bulletAngle = Math.atan2(b.vy, b.vx);
                    const spread = (Math.PI * 2) / b.splitCount;
                    const halfFan = (spread * (b.splitCount - 1)) / 2;
                    const spawnDist = zr + 8;
                    for (let s = 0; s < b.splitCount; s++) {
                        const a = bulletAngle - halfFan + spread * s;
                        this.spawnBullet(b.x + Math.cos(a) * spawnDist, b.y + Math.sin(a) * spawnDist, a, actualDmg * 0.5, 0, b.ricochetCount, z.id);
                    }
                    b.active = false;
                } else if (b.ricochetCount > 0) {
                    // Ricochet: bounce to nearest other, mark this one ignored
                    b.ricochetCount--; b.lifetime += 0.5;
                    b.ignoreEntity = z.id;
                    const target = this.findRicochetTarget(b.x, b.y, z.id);
                    if (target) {
                        const rAngle = Math.atan2(target.y - b.y, target.x - b.x);
                        b.vx = Math.cos(rAngle) * b.speed;
                        b.vy = Math.sin(rAngle) * b.speed;
                    }
                } else b.active = false;

                if (z.hp <= 0) { z.active = false; this.spawnExpOrb(z.x, z.y, z.xp); this.score += 50; }
            }
        }
    }

    updateWallDamage(dt: number): void {
        for (const z of this.zombies) {
            if (!z.active || z.vx !== 0) continue;
            this.wall.hp -= z.damage * dt;
        }
        if (this.wall.hp <= 0) { this.wall.hp = 0; this.mode = GameMode.GameOver; return; }
        // Slow regen (2 HP/s)
        this.wall.hp = Math.min(this.wall.maxHp, this.wall.hp + 2 * dt);
    }

    render(ctx: CanvasRenderingContext2D): void {
        if (!this._bg) {
            this._bg = ctx.createLinearGradient(0, 0, CONFIG.width, 0);
            this._bg.addColorStop(0, "#0b1a0b");
            this._bg.addColorStop(0.5, "#0f1f0f");
            this._bg.addColorStop(1, "#081408");
        }
        ctx.fillStyle = this._bg;
        ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
        ctx.strokeStyle = "rgba(50, 90, 50, 0.15)"; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= CONFIG.width; x += 48) { ctx.moveTo(x, 0); ctx.lineTo(x, CONFIG.height); }
        for (let y = 0; y <= CONFIG.height; y += 48) { ctx.moveTo(0, y); ctx.lineTo(CONFIG.width, y); }
        ctx.stroke();
        this.wall.draw(ctx);
        for (const o of this.expOrbs) if (o.active) o.draw(ctx);
        for (const z of this.zombies) if (z.active) z.draw(ctx);
        for (const b of this.bullets) if (b.active) b.draw(ctx);
        this.shooter.draw(ctx);
        for (const t of this.damageTexts) if (t.active) t.draw(ctx);
        this.drawWaveBar(ctx);
    }

    drawWaveBar(ctx: CanvasRenderingContext2D): void {
        if (this.wave === 0) return;
        const barX = 16, barY = 10, barW = CONFIG.width - 32, barH = 18;
        let progress = 0, label = "", fillColor = "#66bb6a";
        switch (this.wavePhase) {
            case WavePhase.Spawning: {
                const total = this.waveBudget + this.zombies.length;
                const killed = total > 0 ? (total - this.waveBudget - this.zombies.length) : 0;
                progress = total > 0 ? Math.min(1, killed / total) : 0;
                label = `WAVE ${this.wave}  ·  ${this.zombies.length + this.waveBudget}只`;
                break;
            }
            case WavePhase.Fighting: progress = 1; label = `WAVE ${this.wave}  ·  ✓`; break;
            case WavePhase.Resting: progress = 1; label = `NEXT WAVE  ·  ${this.restTimer.toFixed(1)}s`; break;
            case WavePhase.Horde:
                progress = this.waveBudget > 0 ? Math.min(1, (this.waveBudget - this.zombies.length) / this.waveBudget) : 0;
                fillColor = "#ef5350";
                label = `💀 WAVE ${this.wave}  ·  尸潮! ${this.zombies.length}只`;
                break;
        }
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = fillColor; ctx.fillRect(barX, barY, barW * progress, barH);
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
        ctx.fillStyle = "#fff"; ctx.font = "bold 11px monospace";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(label, barX + barW / 2, barY + barH / 2);
    }

    reset(): void {
        this.bullets = []; this.zombies = []; this.expOrbs = []; this.damageTexts = [];
        Zombie.nextId = 1;
        this.score = 0; this.wave = 0; this.waveBudget = 0;
        this.wavePhase = WavePhase.Spawning; this.restTimer = 0;
        this.isBossWave = false; this.spawnTimer = 0;
        this.xp = 0; this.xpToNext = 50; this.level = 0;
        this.mode = GameMode.Playing; this.skipTick = 0;
        this.baseZombieCount = 1;
        this.damageLevel = 1; this.attackSpeedLevel = 1; this.scatterLevel = 1;
        this.splitLevel = 0; this.ricochetLevel = 1; this.burstLevel = 1;
        this.critChanceLevel = 1; this.critDamageLevel = 1;
        this.flatDamageLevel = 1; this.damageMultiplierLevel = 1;
        this.upgradeOptions = [];
        this.wall.hp = CONFIG.wallInitialHp; this.wall.maxHp = CONFIG.wallInitialHp;
        this.rebuildShooter();
    }

    simMs = 0;
}

// ============== Main ==============

function main(): void {
    const canvas = document.getElementById("game") as HTMLCanvasElement;
    canvas.width = CONFIG.width; canvas.height = CONFIG.height;
    const ctx = canvas.getContext("2d")!;
    const manager = new GameManager();
    let lastTime = performance.now(), frameCount = 0, fpsTimer = 0;
    let displayFps = 0, displaySim = 0, displayRender = 0;

    const fpsEl = document.getElementById("fps")!;
    const simEl = document.getElementById("sim-ms")!;
    const renderEl = document.getElementById("render-ms")!;
    const entitiesEl = document.getElementById("entities")!;
    const bulletsEl = document.getElementById("bullets")!;
    const zombiesEl = document.getElementById("zombies")!;
    const scoreEl = document.getElementById("score")!;
    const waveEl = document.getElementById("wave")!;
    const levelEl = document.getElementById("level")!;
    const xpEl = document.getElementById("xp")!;
    const wallEl = document.getElementById("wall-hp")!;
    const messageBox = document.getElementById("message")!;
    const messageTitle = document.getElementById("message-title")!;
    const messageCopy = document.getElementById("message-copy")!;
    const upgradePanel = document.getElementById("upgrade-panel")!;
    const upgradeOpts = [
        document.getElementById("upgrade-0")!, document.getElementById("upgrade-1")!, document.getElementById("upgrade-2")!,
    ];
    const restartBtn = document.getElementById("restart")!;
    const charGrid = document.getElementById("char-grid")!;

    window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (manager.mode === GameMode.GameOver && (e.key === "r" || e.key === "R")) { manager.reset(); return; }
        if (manager.mode === GameMode.LevelUp) {
            const idx = parseInt(e.key) - 1;
            if (idx >= 0 && idx < 3 && manager.upgradeOptions[idx] !== undefined) {
                manager.applyUpgrade(manager.upgradeOptions[idx]);
                manager.mode = GameMode.Playing; manager.skipTick = 1; manager.upgradeOptions = [];
            }
        }
    });
    restartBtn.addEventListener("click", () => { if (manager.mode === GameMode.GameOver) manager.reset(); });

    const FIXED_STEP = 1 / 120;
    const MAX_FRAME_DELTA = 0.1;
    const MAX_CATCH_UP = 12;

    let accumulator = FIXED_STEP;
    let renderStart = 0;

    function loop(now: number): void {
        const elapsed = Math.min((now - lastTime) * 0.001, MAX_FRAME_DELTA);
        lastTime = now;
        accumulator += elapsed;

        let steps = 0;
        const simStart = performance.now();
        while (accumulator >= FIXED_STEP && steps < MAX_CATCH_UP) {
            manager.update(FIXED_STEP);
            accumulator -= FIXED_STEP;
            steps++;
        }
        if (steps === MAX_CATCH_UP) accumulator = 0;
        displaySim = performance.now() - simStart;
        renderStart = performance.now();
        manager.render(ctx);
        displayRender = performance.now() - renderStart;
        frameCount++; fpsTimer += elapsed;
        if (fpsTimer >= 0.5) {
            displayFps = Math.round(frameCount / fpsTimer);
            frameCount = 0; fpsTimer = 0;
        }
        fpsEl.textContent = displayFps.toString();
        simEl.textContent = displaySim.toFixed(2);
        renderEl.textContent = displayRender.toFixed(2);
        entitiesEl.textContent = (manager.bullets.length + manager.zombies.length + manager.expOrbs.length + manager.damageTexts.length + 2).toString();
        bulletsEl.textContent = manager.bullets.length.toString();
        zombiesEl.textContent = manager.zombies.length.toString();
        scoreEl.textContent = manager.score.toString().padStart(6, "0");
        waveEl.textContent = manager.wave.toString();
        levelEl.textContent = manager.level.toString();
        xpEl.textContent = `${Math.floor(manager.xp)}/${manager.xpToNext}`;
        wallEl.textContent = `${Math.ceil(manager.wall.hp)}/${manager.wall.maxHp}`;

        // Character stats
        const sh = manager.shooter;
        charGrid.innerHTML = [
            ["攻击力", `${sh.damage.toFixed(1)}`],
            ["攻速", `${sh.fireInterval.toFixed(2)}s`],
            ["暴击率", `${(sh.critChance * 100).toFixed(1)}%`],
            ["暴伤", `×${sh.critMult.toFixed(2)}`],
            ["散射", `${sh.scatter}`],
            ["分裂", `${sh.split}`],
            ["弹射", `${sh.ricochet}`],
            ["连射", `${sh.burst}`],
        ].map(([label, val]) =>
            `<div><span class="char-label">${label}</span><span class="char-value">${val}</span></div>`
        ).join("");

        const isLevelUp = manager.mode === GameMode.LevelUp;
        if (isLevelUp) {
            upgradePanel.removeAttribute("hidden");
            for (let i = 0; i < 3; i++) {
                const ut = manager.upgradeOptions[i];
                const lv = manager[getLevelKey(ut)] as number;
                upgradeOpts[i].innerHTML =
                    `<span class="key-hint">${i + 1}</span>` +
                    `<span class="upgrade-name">${UPGRADE_NAMES[ut]}</span>` +
                    `<span class="upgrade-desc">${UPGRADE_DESCRIPTIONS[ut]?.(lv) ?? ""}</span>`;
            }
        } else upgradePanel.setAttribute("hidden", "");

        if (manager.mode === GameMode.GameOver) {
            messageBox.removeAttribute("hidden");
            messageTitle.textContent = "失败"; messageCopy.textContent = `得分 ${manager.score.toLocaleString()} · 波次 ${manager.wave} · 按 R 重新开始`;
        } else messageBox.setAttribute("hidden", "");

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

main();
