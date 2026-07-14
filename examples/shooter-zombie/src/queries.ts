import { QueryType, With } from "zero-ecs-lib";
import {
    BulletType,
    DamageTextType,
    ExpOrbType,
    GameEntityType,
    PositionType,
    ShooterType,
    VelocityType,
    WallType,
    ZombieType,
} from "./components";

export const ShooterQuery = QueryType.from(With(PositionType, ShooterType));
export const BulletQuery = QueryType.from(With(PositionType, VelocityType, BulletType));
export const ZombieQuery = QueryType.from(With(PositionType, VelocityType, ZombieType));
export const WallQuery = QueryType.from(With(PositionType, WallType));
export const ExpOrbQuery = QueryType.from(With(PositionType, VelocityType, ExpOrbType));
export const GameEntityQuery = QueryType.from(With(GameEntityType));
export const DamageTextQuery = QueryType.from(With(PositionType, DamageTextType));
