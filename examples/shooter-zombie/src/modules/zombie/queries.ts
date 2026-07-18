import { QueryType, With } from "zero-ecs-lib";
import { PositionType, VelocityType } from "../common/components";
import { WallType, ZombieType } from "./components";

export const ZombieQuery = QueryType.from(With(PositionType, VelocityType, ZombieType));
export const WallQuery = QueryType.from(With(PositionType, WallType));
