import { QueryType, With } from "zero-ecs-lib";
import { PositionType, VelocityType } from "../common/components";
import { DamageTextType, ExpOrbType } from "./components";

export const ExpOrbQuery = QueryType.from(With(PositionType, VelocityType, ExpOrbType));
export const DamageTextQuery = QueryType.from(With(PositionType, DamageTextType));
