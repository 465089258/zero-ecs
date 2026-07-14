import {
    CommandService,
    RandomService,
    TimeState,
    type Mut,
    type QueryOf,
} from "zero-ecs-lib";
import {
    Ball,
    BallType,
    Brick,
    Paddle,
    Position,
    PowerUp,
    Velocity,
} from "./components";
import {
    BallQuery,
    BrickQuery,
    GameEntityQuery,
    PaddleQuery,
    PowerUpQuery,
} from "./queries";
import { GameConfigResource } from "./resources";
import { InputService } from "./services/input-service";
import { RendererService } from "./services/renderer-service";
import { SpawnService } from "./services/spawn-service";
import { GameMode, GameState } from "./states";

type Balls = QueryOf<typeof BallQuery>;
type Paddles = QueryOf<typeof PaddleQuery>;
type Bricks = QueryOf<typeof BrickQuery>;
type Powers = QueryOf<typeof PowerUpQuery>;
type GameEntities = QueryOf<typeof GameEntityQuery>;
interface PaddleSnapshot { x: number; y: number; halfWidth: number; halfHeight: number }
const PADDLE_SNAPSHOT: PaddleSnapshot = { x: 0, y: 0, halfWidth: 0, halfHeight: 0 };

export function startupGameSystem(
    spawn: SpawnService,
    renderer: RendererService,
    game: Mut<GameState>,
    balls: Balls,
    paddle: Paddles,
    bricks: Bricks,
    powers: Powers,
): void {
    renderer.bind(balls, paddle, bricks, powers);
    game.skipTick = 1;
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
        for (let i = 0; i < count; i++) commands.entity(ids[i]).despawn().submit();
    }
    input.clearTransient();
    game.score = 0;
    game.lives = 3;
    game.balls = 0;
    game.bricks = 0;
    game.drops = 0;
    game.entities = 0;
    game.collisions = 0;
    game.splits = 0;
    game.mode = GameMode.Playing;
    game.skipTick = 1;
    spawn.spawnGame();
}

export function paddleMovementSystem(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    input: InputService,
    game: Readonly<GameState>,
    paddle: Paddles,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = paddle.iter();
    while (iter.next()) {
        const [count, , positions, paddles] = iter.current;
        const xs = positions[Position.x];
        const widths = paddles[Paddle.halfWidth];
        const pointer = input.targetX();
        const axis = input.axis();
        for (let i = 0; i < count; i++) {
            let next = xs[i];
            if (axis !== 0) next += axis * config.paddleSpeed * time.delta;
            else if (pointer >= 0) next = pointer;
            const halfWidth = widths[i];
            xs[i] = clamp(next, config.wallInset + halfWidth, config.width - config.wallInset - halfWidth);
        }
    }
}

export function moveBallsSystem(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: CommandService,
    balls: Balls,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const delta = time.delta;
    const iter = balls.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, ballData] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const vxs = velocities[Velocity.x];
        const vys = velocities[Velocity.y];
        const radii = ballData[Ball.radius];
        const active = ballData[Ball.active];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            let x = xs[i] + vxs[i] * delta;
            let y = ys[i] + vys[i] * delta;
            const radius = radii[i];
            if (x - radius < config.wallInset) {
                x = config.wallInset + radius;
                vxs[i] = Math.abs(vxs[i]);
            } else if (x + radius > config.width - config.wallInset) {
                x = config.width - config.wallInset - radius;
                vxs[i] = -Math.abs(vxs[i]);
            }
            if (y - radius < config.wallInset) {
                y = config.wallInset + radius;
                vys[i] = Math.abs(vys[i]);
            }
            xs[i] = x;
            ys[i] = y;
            if (y - radius <= config.height) continue;
            active[i] = 0;
            commands.entity(entities[i]).despawn().submit();
        }
    }
}

export function movePowersSystem(
    config: Readonly<GameConfigResource>,
    time: Readonly<TimeState>,
    game: Readonly<GameState>,
    commands: CommandService,
    powers: Powers,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const iter = powers.iter();
    while (iter.next()) {
        const [count, entities, positions, velocities, powerData] = iter.current;
        const ys = positions[Position.y];
        const vys = velocities[Velocity.y];
        const active = powerData[PowerUp.active];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0) continue;
            ys[i] += vys[i] * time.delta;
            if (ys[i] <= config.height + 20) continue;
            active[i] = 0;
            commands.entity(entities[i]).despawn().submit();
        }
    }
}

export function collisionSystem(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    random: RandomService,
    commands: CommandService,
    spawn: SpawnService,
    balls: Balls,
    paddles: Paddles,
    bricks: Bricks,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    const hasPaddle = readPaddle(paddles, PADDLE_SNAPSHOT);
    const ballIter = balls.iter();
    while (ballIter.next()) {
        const [ballCount, , positions, velocities, ballData] = ballIter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const vxs = velocities[Velocity.x];
        const vys = velocities[Velocity.y];
        const radii = ballData[Ball.radius];
        const activeBalls = ballData[Ball.active];

        for (let ballIndex = 0; ballIndex < ballCount; ballIndex++) {
            if (activeBalls[ballIndex] === 0) continue;
            const radius = radii[ballIndex];
            let x = xs[ballIndex];
            let y = ys[ballIndex];

            if (hasPaddle && vys[ballIndex] > 0 && intersectsBox(
                x, y, radius,
                PADDLE_SNAPSHOT.x, PADDLE_SNAPSHOT.y, PADDLE_SNAPSHOT.halfWidth, PADDLE_SNAPSHOT.halfHeight,
            )) {
                y = PADDLE_SNAPSHOT.y - PADDLE_SNAPSHOT.halfHeight - radius;
                ys[ballIndex] = y;
                const speed = Math.hypot(vxs[ballIndex], vys[ballIndex]);
                const relative = clamp((x - PADDLE_SNAPSHOT.x) / PADDLE_SNAPSHOT.halfWidth, -0.92, 0.92);
                vxs[ballIndex] = speed * relative;
                vys[ballIndex] = -Math.sqrt(Math.max(1, speed * speed - vxs[ballIndex] * vxs[ballIndex]));
            }

            let hit = false;
            const brickIter = bricks.iter();
            while (!hit && brickIter.next()) {
                const [brickCount, brickEntities, brickPositions, brickData] = brickIter.current;
                const brickXs = brickPositions[Position.x];
                const brickYs = brickPositions[Position.y];
                const widths = brickData[Brick.halfWidth];
                const heights = brickData[Brick.halfHeight];
                const activeBricks = brickData[Brick.active];
                for (let brickIndex = 0; brickIndex < brickCount; brickIndex++) {
                    if (activeBricks[brickIndex] === 0 || !intersectsBox(
                        x, y, radius,
                        brickXs[brickIndex], brickYs[brickIndex], widths[brickIndex], heights[brickIndex],
                    )) continue;

                    const dx = x - brickXs[brickIndex];
                    const dy = y - brickYs[brickIndex];
                    const overlapX = widths[brickIndex] + radius - Math.abs(dx);
                    const overlapY = heights[brickIndex] + radius - Math.abs(dy);
                    if (overlapX < overlapY) vxs[ballIndex] = dx < 0 ? -Math.abs(vxs[ballIndex]) : Math.abs(vxs[ballIndex]);
                    else vys[ballIndex] = dy < 0 ? -Math.abs(vys[ballIndex]) : Math.abs(vys[ballIndex]);

                    activeBricks[brickIndex] = 0;
                    commands.entity(brickEntities[brickIndex]).despawn().submit();
                    game.score += 100;
                    game.collisions++;
                    if (random.float() < config.powerDropChance) {
                        spawn.spawnPowerUp(brickXs[brickIndex], brickYs[brickIndex]);
                        game.drops++;
                    }
                    hit = true;
                    break;
                }
            }
        }
    }
}

export function collectPowerSystem(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    commands: CommandService,
    spawn: SpawnService,
    balls: Balls,
    paddles: Paddles,
    powers: Powers,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    if (!readPaddle(paddles, PADDLE_SNAPSHOT)) return;
    let projectedBallCount = game.balls;
    const iter = powers.iter();
    while (iter.next()) {
        const [count, entities, positions, , powerData] = iter.current;
        const active = powerData[PowerUp.active];
        const radii = powerData[PowerUp.radius];
        for (let i = 0; i < count; i++) {
            if (active[i] === 0 || !intersectsBox(
                positions[Position.x][i], positions[Position.y][i], radii[i],
                PADDLE_SNAPSHOT.x, PADDLE_SNAPSHOT.y, PADDLE_SNAPSHOT.halfWidth, PADDLE_SNAPSHOT.halfHeight,
            )) continue;
            active[i] = 0;
            commands.entity(entities[i]).despawn().submit();
            const created = splitBalls(config, spawn, balls, projectedBallCount);
            projectedBallCount += created;
            game.splits += created;
        }
    }
}

export function stressActionsSystem(
    config: Readonly<GameConfigResource>,
    input: InputService,
    game: Mut<GameState>,
    spawn: SpawnService,
    balls: Balls,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    if (input.consumeSplit()) game.splits += splitBalls(config, spawn, balls, game.balls);
    if (input.consumeStress()) {
        const available = Math.max(0, config.maxBalls - game.balls);
        const count = Math.min(config.stressBallCount, available);
        spawn.spawnStressBalls(count);
        game.splits += count;
    }
}

export function lifecycleSystem(
    config: Readonly<GameConfigResource>,
    game: Mut<GameState>,
    spawn: SpawnService,
    balls: Balls,
): void {
    if (game.skipTick || game.mode !== GameMode.Playing) return;
    if (countActiveBalls(balls) !== 0) return;
    if (game.lives > 1) {
        game.lives--;
        spawn.spawnBall(config.width * 0.5, config.paddleY - 28, 0, -config.ballSpeed);
    } else {
        game.lives = 0;
        game.mode = GameMode.GameOver;
    }
}

export function statisticsSystem(
    game: Mut<GameState>,
    balls: Balls,
    bricks: Bricks,
    powers: Powers,
    entities: GameEntities,
): void {
    const previousBricks = game.bricks;
    game.balls = countActiveBalls(balls);
    game.bricks = countActiveBricks(bricks);
    game.drops = countActivePowers(powers);
    game.entities = countEntities(entities);
    if (!game.skipTick && game.mode === GameMode.Playing && previousBricks > 0 && game.bricks === 0) {
        game.mode = GameMode.Won;
    }
    game.skipTick = 0;
}

function splitBalls(
    config: Readonly<GameConfigResource>,
    spawn: SpawnService,
    balls: Balls,
    knownBallCount: number,
): number {
    let created = 0;
    const available = Math.max(0, config.maxBalls - knownBallCount);
    const iter = balls.iter();
    while (created < available && iter.next()) {
        const [count, , positions, velocities, ballData] = iter.current;
        const active = ballData[Ball.active];
        for (let i = 0; i < count && created < available; i++) {
            if (active[i] === 0) continue;
            const vx = velocities[Velocity.x][i];
            const vy = velocities[Velocity.y][i];
            const speed = Math.hypot(vx, vy);
            const angle = Math.atan2(vy, vx);
            const spread = 0.13 + (created & 3) * 0.018;
            velocities[Velocity.x][i] = Math.cos(angle - spread) * speed;
            velocities[Velocity.y][i] = Math.sin(angle - spread) * speed;
            spawn.spawnBall(
                positions[Position.x][i],
                positions[Position.y][i],
                Math.cos(angle + spread) * speed,
                Math.sin(angle + spread) * speed,
            );
            created++;
        }
    }
    return created;
}

function readPaddle(query: Paddles, target: PaddleSnapshot): boolean {
    const iter = query.iter();
    if (!iter.next()) return false;
    const [count, , positions, paddles] = iter.current;
    if (count === 0) return false;
    target.x = positions[Position.x][0];
    target.y = positions[Position.y][0];
    target.halfWidth = paddles[Paddle.halfWidth][0];
    target.halfHeight = paddles[Paddle.halfHeight][0];
    return true;
}

function countActiveBalls(query: Balls): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , , balls] = iter.current;
        const active = balls[Ball.active];
        for (let i = 0; i < count; i++) total += active[i] !== 0 ? 1 : 0;
    }
    return total;
}

function countActiveBricks(query: Bricks): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , bricks] = iter.current;
        const active = bricks[Brick.active];
        for (let i = 0; i < count; i++) total += active[i] !== 0 ? 1 : 0;
    }
    return total;
}

function countActivePowers(query: Powers): number {
    let total = 0;
    const iter = query.iter();
    while (iter.next()) {
        const [count, , , , powers] = iter.current;
        const active = powers[PowerUp.active];
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

function intersectsBox(
    circleX: number,
    circleY: number,
    radius: number,
    boxX: number,
    boxY: number,
    halfWidth: number,
    halfHeight: number,
): boolean {
    const closestX = clamp(circleX, boxX - halfWidth, boxX + halfWidth);
    const closestY = clamp(circleY, boxY - halfHeight, boxY + halfHeight);
    const dx = circleX - closestX;
    const dy = circleY - closestY;
    return dx * dx + dy * dy <= radius * radius;
}

function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
}
