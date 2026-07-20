import { QueryType, With } from "@zero-ecs/game";
import {
    BallType,
    BrickType,
    GameEntityType,
    PaddleType,
    PositionType,
    PowerUpType,
    VelocityType,
} from "./components";

export const BallQuery = QueryType.from(With(PositionType, VelocityType, BallType));
export const PaddleQuery = QueryType.from(With(PositionType, PaddleType));
export const BrickQuery = QueryType.from(With(PositionType, BrickType));
export const PowerUpQuery = QueryType.from(With(PositionType, VelocityType, PowerUpType));
export const GameEntityQuery = QueryType.from(With(GameEntityType));
