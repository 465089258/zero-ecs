import { With } from "zero-ecs-lib";
import { PositionType, VelocityType } from "../common/components";
import { ExpOrbType } from "./components";
export const ExpOrbQuery = With(PositionType, VelocityType, ExpOrbType);
