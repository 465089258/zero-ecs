import {
    Resource,
    Service,
    State,
    type QueryOf,
} from "zero-ecs-lib";
import {
    Ball,
    Brick,
    Paddle,
    Position,
    PowerUp,
} from "../components";
import { BallQuery, BrickQuery, PaddleQuery, PowerUpQuery } from "../queries";
import { GameConfigResource, GameViewResource } from "../resources";
import { GameMode, GameState } from "../states";
import { MetricsService } from "./metrics-service";

const BRICK_COLORS = ["#5ee7f7", "#67a6ff", "#8f7cff", "#d879ff", "#ff7595"] as const;
export class RendererService extends Service {
    @Resource.inject(GameViewResource) private readonly view!: GameViewResource;
    @Resource.inject(GameConfigResource) private readonly config!: GameConfigResource;
    @State.inject(GameState) private readonly game!: GameState;
    @Service.inject(MetricsService) private readonly metrics!: MetricsService;

    private balls: QueryOf<typeof BallQuery> | undefined;
    private paddle: QueryOf<typeof PaddleQuery> | undefined;
    private bricks: QueryOf<typeof BrickQuery> | undefined;
    private powers: QueryOf<typeof PowerUpQuery> | undefined;
    private background: CanvasGradient | undefined;
    private telemetryAt = 0;

    init(): void {
        const { canvas, context } = this.view;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        canvas.width = this.config.width * ratio;
        canvas.height = this.config.height * ratio;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.background = context.createLinearGradient(0, 0, 0, this.config.height);
        this.background.addColorStop(0, "#0c1631");
        this.background.addColorStop(0.52, "#080e20");
        this.background.addColorStop(1, "#050916");
    }

    bind(
        balls: QueryOf<typeof BallQuery>,
        paddle: QueryOf<typeof PaddleQuery>,
        bricks: QueryOf<typeof BrickQuery>,
        powers: QueryOf<typeof PowerUpQuery>,
    ): void {
        this.balls = balls;
        this.paddle = paddle;
        this.bricks = bricks;
        this.powers = powers;
    }

    render(now: number): void {
        const started = performance.now();
        const ctx = this.view.context;
        ctx.fillStyle = this.background ?? "#080e20";
        ctx.fillRect(0, 0, this.config.width, this.config.height);
        this.drawGrid(ctx);
        this.drawBricks(ctx);
        this.drawPowers(ctx, now);
        this.drawPaddle(ctx);
        this.drawBalls(ctx);
        this.metrics.recordRender(performance.now() - started, now);
        if (now >= this.telemetryAt) {
            this.telemetryAt = now + 100;
            this.updateTelemetry();
        }
    }

    private drawGrid(ctx: CanvasRenderingContext2D): void {
        ctx.strokeStyle = "rgba(102, 132, 199, 0.055)";
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

    private drawBalls(ctx: CanvasRenderingContext2D): void {
        const query = this.balls;
        if (!query) return;
        ctx.fillStyle = "#eefcff";
        ctx.shadowColor = "#5ee7f7";
        ctx.shadowBlur = 9;
        ctx.beginPath();
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, , balls] = iter.current;
            const xs = positions[Position.x];
            const ys = positions[Position.y];
            const radii = balls[Ball.radius];
            const active = balls[Ball.active];
            for (let i = 0; i < count; i++) {
                if (active[i] === 0) continue;
                const radius = radii[i];
                ctx.moveTo(xs[i] + radius, ys[i]);
                ctx.arc(xs[i], ys[i], radius, 0, Math.PI * 2);
            }
        }
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    private drawPaddle(ctx: CanvasRenderingContext2D): void {
        const query = this.paddle;
        if (!query) return;
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, paddles] = iter.current;
            for (let i = 0; i < count; i++) {
                const halfWidth = paddles[Paddle.halfWidth][i];
                const halfHeight = paddles[Paddle.halfHeight][i];
                const x = positions[Position.x][i] - halfWidth;
                const y = positions[Position.y][i] - halfHeight;
                ctx.fillStyle = "rgba(94, 231, 247, 0.16)";
                ctx.fillRect(x - 4, y - 4, halfWidth * 2 + 8, halfHeight * 2 + 8);
                ctx.fillStyle = "#5ee7f7";
                ctx.fillRect(x, y, halfWidth * 2, halfHeight * 2);
                ctx.fillStyle = "rgba(255,255,255,.8)";
                ctx.fillRect(x + 8, y + 2, halfWidth * 2 - 16, 2);
            }
        }
    }

    private drawBricks(ctx: CanvasRenderingContext2D): void {
        const query = this.bricks;
        if (!query) return;
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, bricks] = iter.current;
            const xs = positions[Position.x];
            const ys = positions[Position.y];
            const widths = bricks[Brick.halfWidth];
            const heights = bricks[Brick.halfHeight];
            const colors = bricks[Brick.color];
            const hitPoints = bricks[Brick.hp];
            const maxHitPoints = bricks[Brick.maxHp];
            const armored = bricks[Brick.armored];
            const active = bricks[Brick.active];
            for (let i = 0; i < count; i++) {
                if (active[i] === 0) continue;
                const halfWidth = widths[i];
                const halfHeight = heights[i];
                const x = xs[i] - halfWidth;
                const y = ys[i] - halfHeight;
                const width = halfWidth * 2;
                const height = halfHeight * 2;
                const health = hitPoints[i] / maxHitPoints[i];
                const isArmored = armored[i] !== 0;
                ctx.fillStyle = isArmored ? "#ffb45f" : BRICK_COLORS[colors[i] % BRICK_COLORS.length];
                ctx.globalAlpha = 0.25 + health * 0.68;
                ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
                ctx.globalAlpha = 1;
                ctx.fillStyle = "rgba(255,255,255,.32)";
                ctx.fillRect(x + 3, y + 3, width - 6, 2);
                ctx.fillStyle = isArmored ? "rgba(255,180,95,.95)" : "rgba(94,231,247,.75)";
                ctx.fillRect(x + 3, y + height - 4, (width - 6) * health, 2);
                if (isArmored) {
                    ctx.strokeStyle = "rgba(255, 213, 148, .8)";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
                }
            }
        }
    }

    private drawPowers(ctx: CanvasRenderingContext2D, now: number): void {
        const query = this.powers;
        if (!query) return;
        const pulse = 1 + Math.sin(now * 0.008) * 0.16;
        const iter = query.iter();
        while (iter.next()) {
            const [count, , positions, , powers] = iter.current;
            const active = powers[PowerUp.active];
            const radii = powers[PowerUp.radius];
            for (let i = 0; i < count; i++) {
                if (active[i] === 0) continue;
                const x = positions[Position.x][i];
                const y = positions[Position.y][i];
                const radius = radii[i] * pulse;
                ctx.fillStyle = "rgba(94,231,247,.16)";
                ctx.beginPath();
                ctx.arc(x, y, radius + 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#5ee7f7";
                ctx.beginPath();
                ctx.moveTo(x, y - radius);
                ctx.lineTo(x + radius, y);
                ctx.lineTo(x, y + radius);
                ctx.lineTo(x - radius, y);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = "#07101e";
                ctx.font = "bold 11px DM Mono, monospace";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("×2", x, y + 1);
            }
        }
    }

    private updateTelemetry(): void {
        const ui = this.view.telemetry;
        ui.fps.textContent = this.metrics.fps.toFixed(0);
        ui.simMs.textContent = this.metrics.simulationMs.toFixed(2);
        ui.renderMs.textContent = this.metrics.renderMs.toFixed(2);
        ui.entities.textContent = this.game.entities.toLocaleString();
        ui.balls.textContent = this.game.balls.toLocaleString();
        ui.bricks.textContent = this.game.bricks.toLocaleString();
        ui.score.textContent = this.game.score.toString().padStart(6, "0");
        ui.lives.textContent = "● ".repeat(Math.max(0, this.game.lives)).trim();

        const halted = this.game.mode !== GameMode.Playing;
        ui.message.hidden = !halted;
        if (!halted) return;
        ui.messageTitle.textContent = this.game.mode === GameMode.Won ? "BRICK FIELD CLEARED" : "SIMULATION HALTED";
        ui.messageCopy.textContent = `得分 ${this.game.score.toLocaleString()} · 按 R 或点击重新开始`;
    }
}
