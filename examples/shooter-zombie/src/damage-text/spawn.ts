import { CommandService } from "zero-ecs-lib";
import { Position, PositionType, GameEntityType } from "../common/components";
import { DamageText, DamageTextType } from "./components";

export function spawnDamageText(commands: CommandService, x: number, y: number, value: number, isCrit: number): void {
    commands.spawn()
        .add(GameEntityType).add(PositionType)
        .set(PositionType, Position.x, x).set(PositionType, Position.y, y)
        .add(DamageTextType)
        .set(DamageTextType, DamageText.value, value)
        .set(DamageTextType, DamageText.lifetime, 0.7)
        .set(DamageTextType, DamageText.floatY, y)
        .set(DamageTextType, DamageText.isCrit, isCrit)
        .submit();
}
