import { With } from "zero-ecs-lib";
import { PositionType } from "../common/components";
import { ShooterType } from "./components";
export const ShooterQuery = With(PositionType, ShooterType);
