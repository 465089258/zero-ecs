import {
    CommandService,
    RandomService,
    Resource,
    Service,
} from "zero-ecs-lib";
import {
    Ball,
    BallType,
    Brick,
    BrickType,
    GameEntityType,
    Paddle,
    PaddleType,
    Position,
    PositionType,
    PowerUp,
    PowerUpType,
    Velocity,
    VelocityType,
} from "../components";
import { GameConfigResource } from "../resources";

export class SpawnService extends Service {
    @Service.inject(CommandService) private readonly commands!: CommandService;
    @Service.inject(RandomService) private readonly random!: RandomService;
    @Resource.inject(GameConfigResource) private readonly config!: GameConfigResource;

    spawnGame(): void {
        this.spawnPaddle();
        this.spawnBall(this.config.width * 0.5, this.config.paddleY - 28, 0, -this.config.ballSpeed);
        this.spawnBricks();
    }

    spawnPaddle(): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, this.config.width * 0.5)
            .set(PositionType, Position.y, this.config.paddleY)
            .add(PaddleType)
            .set(PaddleType, Paddle.halfWidth, 66)
            .set(PaddleType, Paddle.halfHeight, 9)
            .submit();
    }

    spawnBall(x: number, y: number, vx: number, vy: number): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, x)
            .set(PositionType, Position.y, y)
            .add(VelocityType)
            .set(VelocityType, Velocity.x, vx)
            .set(VelocityType, Velocity.y, vy)
            .add(BallType)
            .set(BallType, Ball.radius, 5)
            .set(BallType, Ball.active, 1)
            .submit();
    }

    spawnPowerUp(x: number, y: number): void {
        this.commands.spawn()
            .add(GameEntityType)
            .add(PositionType)
            .set(PositionType, Position.x, x)
            .set(PositionType, Position.y, y)
            .add(VelocityType)
            .set(VelocityType, Velocity.x, 0)
            .set(VelocityType, Velocity.y, this.config.powerDropSpeed)
            .add(PowerUpType)
            .set(PowerUpType, PowerUp.radius, 10)
            .set(PowerUpType, PowerUp.active, 1)
            .submit();
    }

    spawnStressBalls(count: number): void {
        const x = this.config.width * 0.5;
        const y = this.config.paddleY - 42;
        for (let i = 0; i < count; i++) {
            const angle = this.random.float(-1.15, 1.15);
            const speed = this.config.ballSpeed * this.random.float(0.82, 1.18);
            this.spawnBall(x, y, Math.sin(angle) * speed, -Math.cos(angle) * speed);
        }
    }

    private spawnBricks(): void {
        const config = this.config;
        const fieldWidth = config.brickColumns * config.brickSize +
            (config.brickColumns - 1) * config.brickGap;
        const left = (config.width - fieldWidth) * 0.5;
        for (let row = 0; row < config.brickRows; row++) {
            const y = config.brickTop + config.brickSize * 0.5 + row * (config.brickSize + config.brickGap);
            for (let column = 0; column < config.brickColumns; column++) {
                const x = left + config.brickSize * 0.5 + column * (config.brickSize + config.brickGap);
                const armored = row === 0 || row === config.brickRows - 1 ||
                    column === 0 || column === config.brickColumns - 1;
                const hp = armored
                    ? config.armoredBrickHp
                    : config.innerBrickMinHp + (row * 3 + column * 5) % config.innerBrickHpRange;
                this.commands.spawn()
                    .add(GameEntityType)
                    .add(PositionType)
                    .set(PositionType, Position.x, x)
                    .set(PositionType, Position.y, y)
                    .add(BrickType)
                    .set(BrickType, Brick.halfWidth, config.brickSize * 0.5)
                    .set(BrickType, Brick.halfHeight, config.brickSize * 0.5)
                    .set(BrickType, Brick.color, row % 5)
                    .set(BrickType, Brick.hp, hp)
                    .set(BrickType, Brick.maxHp, hp)
                    .set(BrickType, Brick.armored, armored ? 1 : 0)
                    .set(BrickType, Brick.active, 1)
                    .submit();
            }
        }
    }
}
