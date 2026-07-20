import { With } from "zero-ecs-lib";
import { PositionType, VelocityType } from "../common/components";
import { ZombieType } from "./components";
export const ZombieQuery = With(PositionType, VelocityType, ZombieType);
