import { QueryType, With } from "@zero-ecs/game";
import { PositionType, VelocityType } from "../common";
import { ExperienceCollectorType, ExpOrbType } from "./components";

export const ExpOrbQuery = QueryType.from(With(PositionType, VelocityType, ExpOrbType));
export const ExperienceCollectorQuery = QueryType.from(With(PositionType, ExperienceCollectorType));
