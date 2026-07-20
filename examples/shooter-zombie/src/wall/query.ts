import { With } from "zero-ecs-lib";
import { PositionType } from "../common/components";
import { WallType } from "./components";
export const WallQuery = With(PositionType, WallType);
