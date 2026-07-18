import {
    Resource,
    Service,
    State,
    type QueryOf,
} from "zero-ecs-lib";
import {
    Position,
} from "../common/components";
import { GameMode, GameState, UPGRADE_DESCRIPTIONS, UPGRADE_NAMES, UpgradeType } from "../common/game-state";
import { GameConfigResource, GameViewResource } from "../common/resources";
import { MetricsService } from "../common/services/metrics-service";
import { Bullet } from "../projectile/components";
import { BulletQuery } from "../projectile/queries";
import { DamageText, ExpOrb } from "../progression/components";
import { DamageTextQuery, ExpOrbQuery } from "../progression/queries";
import { Shooter } from "../shooter/components";
import { ShooterQuery } from "../shooter/queries";
import { Wall, Zombie } from "../zombie/components";
import { WallQuery, ZombieQuery } from "../zombie/queries";

const GROUND_COLOR = "#1a2a1a";
const GRID_COLOR = "rgba(50, 90, 50, 0.15)";
const SHOOTER_COLOR = "#4fc3f7";
const BULLET_COLOR = "#ffe082";
const ZOMBIE_COLOR = "#66bb6a";
const ZOMBIE_DAMAGED = "#ef5350";
const WALL_COLOR = "#90a4ae";
const WALL_DAMAGED_COLOR = "#ff8a65";
const EXP_ORB_COLOR = "#ba68c8";
const BAR_BG_COLOR = "rgba(0,0,0,0.5)";

export class RendererService extends Service {
    @Resource.inject(GameViewResource) private readonly view!: GameViewResource;
    @Resource.inject(GameConfigResource) private readonly config!: GameConfigResource;
    @State.inject(GameState) private readonly game!: GameState;
    @Service.inject(MetricsService) private readonly metrics!: MetricsService;

    private shooter: QueryOf<typeof ShooterQuery> | undefined;
    private bullets: QueryOf<typeof BulletQuery> | undefined;
    private zombies: QueryOf<typeof ZombieQuery> | undefined;
    private walls: QueryOf<typeof WallQuery> | undefined;
    private expOrbs: QueryOf<typeof ExpOrbQuery> | undefined;
    private damageTexts: QueryOf<typeof DamageTextQuery> | undefined;
    private background: CanvasGradient | undefined;
    private telemetryAt = 0;

    init(): void {
        const { canvas, context } = this.view;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = this.config.width * ratio;
        canvas.height = this.config.height * ratio;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.background = context.createLinearGradient(0, 0, this.config.width, 0);
        this.background.addColorStop(0, "#0b1a0b");
        this.background.addColorStop(0.5, "#0f1f0f");
        this.background.addColorStop(1, "#081408");
    }

    bind(
        shooter: QueryOf<typeof ShooterQuery>,
        bullets: QueryOf<typeof BulletQuery>,
        zombies: QueryOf<typeof ZombieQuery>,
        walls: QueryOf<typeof WallQuery>,
        expOrbs: QueryOf<typeof ExpOrbQuery>,
        damageTexts: QueryOf<typeof DamageTextQuery>,
    ): void {
        this.shooter = shooter;
        this.bullets = bullets;
        this.zombies = zombies;
        this.walls = walls;
        this.expOrbs = expOrbs;
        this.damageTexts = damageTexts;
    }

    render(now: number): void {
        const started = performance.now();
        const ctx = this.view.context;
        ctx.fillStyle = this.background ?? "#0b1a0b";
        ctx.fillRect(0, 0, this.config.width, this.config.height);
        this.drawGrid(ctx);
        this.drawWaveBar(ctx);
        this.drawWalls(ctx);
        this.drawExpOrbs(ctx, now);
        this.drawZombies(ctx);
        this.drawBullets(ctx);
        this.drawShooter(ctx);
        this.drawDamageTexts(ctx);
        this.metrics.recordRender(performance.now() - started, now);
        if (now >= this.telemetryAt) {
            this.telemetryAt = now + 100;
            this.updateTelemetry();
        }
    }

    private drawWaveBar(ctx: CanvasRenderingContext2D): void {
        const { wave, inHorde, waveZombieTotal, waveTimer, waveDuration, zombies } = this.game;
        if (wave === 0) return;

        const barX = 16;
        const barY = 10;
        const barW = this.config.width - 32;
        const barH = 18;

        // Progress: time-based during wave, kill-based during horde
        let progress: number;
        if (inHorde) {
            const remaining = zombies;
            progress = waveZombieTotal > 0
                ? Math.min(1, (waveZombieTotal - remaining) / waveZombieTotal)
                : 0;
        } else {
            progress = waveDuration > 0
                ? Math.min(1, 1 - waveTimer / waveDuration)
                : 0;
        }

        // Background
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(barX, barY, barW, barH);

        // Progress fill
        const fillColor = inHorde ? "#ef5350" : "#66bb6a";
        ctx.fillStyle = fillColor;
        ctx.fillRect(barX, barY, barW * progress, barH);

        // Border
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Text
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const label = inHorde
            ? `WAVE ${wave} · 尸潮! ${zombies}只`
            : `WAVE ${wave} · ${waveTimer.toFixed(1)}s`;
        ctx.fillText(label, barX + barW / 2, barY + barH / 2);
    }

    private drawGrid(ctx: CanvasRenderingContext2D): void {
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= this.config.width; x += 48) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.config.height);
        }
        for (let y = 0; y <= this.config.height; y += 48) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.config.width, y);
        }
        ctx.stroke();
    }

    private drawShooter(ctx: CanvasRenderingContext2D): void {
        const query = this.shooter;
        if (!query) return;
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, shooters] = iter.current;
            for (let i = 0; i < count; i++) {
                const x = positions[Position.x][i];
                const y = positions[Position.y][i];
                // Draw archer figure
                ctx.fillStyle = SHOOTER_COLOR;
                ctx.shadowColor = SHOOTER_COLOR;
                ctx.shadowBlur = 12;
                // Body
                ctx.fillRect(x - 8, y - 14, 16, 28);
                // Head
                ctx.beginPath();
                ctx.arc(x, y - 20, 9, 0, Math.PI * 2);
                ctx.fill();
                // Bow
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x + 10, y, 14, -Math.PI * 0.45, Math.PI * 0.45);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + 10, y - 10);
                ctx.lineTo(x + 24, y);
                ctx.lineTo(x + 10, y + 10);
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Level label
                ctx.fillStyle = "#fff";
                ctx.font = "bold 10px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(`Lv.${this.game.level}`, x, y + 20);
            }
        }
    }

    private drawBullets(ctx: CanvasRenderingContext2D): void {
        const query = this.bullets;
        if (!query) return;
        ctx.fillStyle = BULLET_COLOR;
        ctx.shadowColor = BULLET_COLOR;
        ctx.shadowBlur = 6;
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, , bullets] = iter.current;
            const xs = positions[Position.x];
            const ys = positions[Position.y];
            const active = bullets[Bullet.active];
            for (let i = 0; i < count; i++) {
                if (active[i] === 0) continue;
                const radius = bullets[Bullet.radius][i];
                ctx.beginPath();
                ctx.arc(xs[i], ys[i], radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.shadowBlur = 0;
    }

    private drawZombies(ctx: CanvasRenderingContext2D): void {
        const query = this.zombies;
        if (!query) return;
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, , zombies] = iter.current;
            const xs = positions[Position.x];
            const ys = positions[Position.y];
            const hp = zombies[Zombie.hp];
            const maxHp = zombies[Zombie.maxHp];
            const active = zombies[Zombie.active];
            const radius = this.config.zombieRadius;
            const halfW = this.config.zombieHalfWidth;
            const halfH = this.config.zombieHalfHeight;

            for (let i = 0; i < count; i++) {
                if (active[i] === 0) continue;
                const x = xs[i];
                const y = ys[i];
                const health = hp[i] / maxHp[i];

                // Body
                const bodyColor = health < 0.3 ? ZOMBIE_DAMAGED : ZOMBIE_COLOR;
                ctx.fillStyle = bodyColor;
                ctx.shadowColor = bodyColor;
                ctx.shadowBlur = 6;
                ctx.fillRect(x - halfW, y - halfH, halfW * 2, halfH * 2);
                // Head
                ctx.beginPath();
                ctx.arc(x, y - halfH - 3, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Eyes
                ctx.fillStyle = "#fff";
                ctx.fillRect(x - 4, y - halfH - 6, 3, 3);
                ctx.fillRect(x + 1, y - halfH - 6, 3, 3);
                ctx.fillStyle = "#000";
                ctx.fillRect(x - 3, y - halfH - 5, 2, 2);
                ctx.fillRect(x + 2, y - halfH - 5, 2, 2);

                // HP bar
                const barW = halfW * 2;
                const barH = 4;
                const barY = y - halfH - 16;
                ctx.fillStyle = BAR_BG_COLOR;
                ctx.fillRect(x - barW / 2, barY, barW, barH);
                ctx.fillStyle = health > 0.5 ? "#66bb6a" : health > 0.25 ? "#ffa726" : "#ef5350";
                ctx.fillRect(x - barW / 2, barY, barW * health, barH);
            }
        }
    }

    private drawWalls(ctx: CanvasRenderingContext2D): void {
        const query = this.walls;
        if (!query) return;
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, walls] = iter.current;
            for (let i = 0; i < count; i++) {
                const x = positions[Position.x][i];
                const y = positions[Position.y][i];
                const hp = walls[Wall.hp][i];
                const maxHp = walls[Wall.maxHp][i];
                const health = hp / maxHp;

                const c = this.config;
                const halfW = c.wallHalfWidth;
                const halfH = c.wallHalfHeight;

                // Brick pattern wall
                const color = health < 0.3 ? WALL_DAMAGED_COLOR : WALL_COLOR;
                ctx.fillStyle = color;
                ctx.fillRect(x - halfW, y - halfH, halfW * 2, halfH * 2);

                // Brick lines
                ctx.strokeStyle = "rgba(0,0,0,0.3)";
                ctx.lineWidth = 1;
                const brickH = 12;
                ctx.beginPath();
                for (let row = y - halfH; row < y + halfH; row += brickH) {
                    ctx.moveTo(x - halfW, row);
                    ctx.lineTo(x + halfW, row);
                    // offset every other row
                    const off = Math.floor((row - y + halfH) / brickH) % 2 === 0 ? 0 : halfW * 0.5;
                    for (let col = x - halfW + off; col < x + halfW; col += halfW) {
                        ctx.moveTo(col, row);
                        ctx.lineTo(col, row + brickH);
                    }
                }
                ctx.stroke();

                // Cracks when damaged
                if (health < 0.6) {
                    ctx.strokeStyle = "rgba(0,0,0,0.5)";
                    ctx.lineWidth = 2;
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

                // HP bar on top
                const barW = halfW * 2;
                const barH = 6;
                const barY = y - halfH - 12;
                ctx.fillStyle = BAR_BG_COLOR;
                ctx.fillRect(x - barW / 2, barY, barW, barH);
                ctx.fillStyle = health > 0.5 ? "#66bb6a" : health > 0.25 ? "#ffa726" : "#ef5350";
                ctx.fillRect(x - barW / 2, barY, barW * health, barH);
                ctx.fillStyle = "#fff";
                ctx.font = "9px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillText(`Wall ${Math.ceil(hp)}/${maxHp}`, x, barY - 2);
            }
        }
    }

    private drawExpOrbs(ctx: CanvasRenderingContext2D, now: number): void {
        const query = this.expOrbs;
        if (!query) return;
        const pulse = 1 + Math.sin(now * 0.006) * 0.2;
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, , orbs] = iter.current;
            const xs = positions[Position.x];
            const ys = positions[Position.y];
            const active = orbs[ExpOrb.active];
            for (let i = 0; i < count; i++) {
                if (active[i] === 0) continue;
                const x = xs[i];
                const y = ys[i];
                const radius = orbs[ExpOrb.radius][i] * pulse;
                ctx.fillStyle = "rgba(186, 104, 200, 0.2)";
                ctx.beginPath();
                ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = EXP_ORB_COLOR;
                ctx.shadowColor = EXP_ORB_COLOR;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                // XP text
                ctx.fillStyle = "#fff";
                ctx.font = "bold 7px monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("XP", x, y);
            }
        }
    }

    private drawDamageTexts(ctx: CanvasRenderingContext2D): void {
        const query = this.damageTexts;
        if (!query) return;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, textData] = iter.current;
            const xs = positions[Position.x];
            const ys = positions[Position.y];
            const values = textData[DamageText.value];
            const lifetimes = textData[DamageText.lifetime];

            for (let i = 0; i < count; i++) {
                const alpha = Math.min(1, lifetimes[i] / 0.3);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = "#ffeb3b";
                ctx.font = "bold 12px monospace";
                ctx.strokeStyle = "rgba(0,0,0,0.6)";
                ctx.lineWidth = 2;
                const text = Math.round(values[i]).toString();
                ctx.strokeText(text, xs[i], ys[i]);
                ctx.fillText(text, xs[i], ys[i]);
            }
        }
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
    }

    private updateTelemetry(): void {
        const ui = this.view.telemetry;
        ui.fps.textContent = this.metrics.fps.toFixed(0);
        ui.simMs.textContent = this.metrics.simulationMs.toFixed(2);
        ui.renderMs.textContent = this.metrics.renderMs.toFixed(2);
        ui.entities.textContent = this.game.entities.toLocaleString();
        ui.bullets.textContent = this.game.bullets.toLocaleString();
        ui.zombies.textContent = this.game.zombies.toLocaleString();
        ui.score.textContent = this.game.score.toString().padStart(6, "0");
        ui.wave.textContent = this.game.wave.toString();
        ui.level.textContent = this.game.level.toString();
        ui.xp.textContent = `${this.game.xp}/${this.game.xpToNext}`;
        ui.wallHp.textContent = `${Math.ceil(this.game.wallHp)}/${this.game.wallMaxHp}`;

        // Upgrade panel
        const isLevelUp = this.game.mode === GameMode.LevelUp;
        this.view.upgradeContainer.hidden = !isLevelUp;
        if (isLevelUp && this.game.upgradeOptions.length === 3) {
            const slots = this.view.upgradeSlots;
            const options = this.game.upgradeOptions;
            for (let i = 0; i < 3; i++) {
                const upgrade = options[i] as UpgradeType;
                const levelKey = getLevelKey(upgrade);
                const currentLevel = (this.game as unknown as Record<string, number>)[levelKey] ?? 1;
                slots[i].innerHTML = `
                    <span class="key-hint">${i + 1}</span>
                    <span class="upgrade-name">${UPGRADE_NAMES[upgrade] ?? "?"}</span>
                    <span class="upgrade-desc">${UPGRADE_DESCRIPTIONS[upgrade]?.(currentLevel) ?? ""}</span>
                `;
            }
        }

        const halted = this.game.mode !== GameMode.Playing;
        ui.message.hidden = !halted;
        if (!halted) return;
        if (this.game.mode === GameMode.GameOver) {
            ui.messageTitle.textContent = "DEFEAT";
            ui.messageCopy.textContent = `得分 ${this.game.score.toLocaleString()} · Wave ${this.game.wave} · 按 R 重新开始`;
        } else if (this.game.mode === GameMode.LevelUp) {
            ui.messageTitle.textContent = "LEVEL UP!";
            ui.messageCopy.textContent = `按 1/2/3 选择升级`;
        }
    }
}

function getLevelKey(upgrade: UpgradeType): string {
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
