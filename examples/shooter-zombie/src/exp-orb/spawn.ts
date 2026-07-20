import { CommandService } from "zero-ecs-lib";
import { Position, PositionType, Velocity, VelocityType, GameEntityType } from "../common/components";
import { ExpOrb, ExpOrbType } from "./components";
import { ExpOrbConfig } from "./config";

export function spawnExpOrb(commands: CommandService, cfg: ExpOrbConfig, x: number, y: number, value: number): void {
    commands.spawn()
        .add(GameEntityType).add(PositionType)
        .set(PositionType, Position.x, x).set(PositionType, Position.y, y)
        .add(VelocityType)
        .set(VelocityType, Velocity.x, -cfg.speed).set(VelocityType, Velocity.y, 0)
        .add(ExpOrbType)
        .set(ExpOrbType, ExpOrb.value, value).set(ExpOrbType, ExpOrb.speed, 0)
        .set(ExpOrbType, ExpOrb.active, 1)
        .submit();
}
