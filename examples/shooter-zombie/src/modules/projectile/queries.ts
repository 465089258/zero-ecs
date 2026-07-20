import { QueryType, With } from "@zero-ecs/game";
import { PositionType, VelocityType } from "../common/components";
import { BulletType } from "./components";

export const BulletQuery = QueryType.from(With(PositionType, VelocityType, BulletType));
