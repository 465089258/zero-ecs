import { With } from "zero-ecs-lib";
import { PositionType, VelocityType } from "../common/components";
import { BulletType } from "./components";
export const BulletQuery = With(PositionType, VelocityType, BulletType);
