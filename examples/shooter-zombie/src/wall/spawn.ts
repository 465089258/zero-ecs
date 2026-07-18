import { CommandService } from "zero-ecs-lib";
import { Position, PositionType, GameEntityType } from "../common/components";
import { Wall, WallType } from "./components";
import { WallConfig } from "./config";

export function spawnWall(commands: CommandService, cfg: WallConfig): void {
    commands.spawn()
        .add(GameEntityType).add(PositionType)
        .set(PositionType, Position.x, cfg.x).set(PositionType, Position.y, cfg.y)
        .add(WallType)
        .set(WallType, Wall.hp, cfg.initialHp).set(WallType, Wall.maxHp, cfg.initialHp)
        .submit();
}
