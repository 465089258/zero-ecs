import { With } from "zero-ecs-lib";
import { PositionType } from "../common/components";
import { DamageTextType } from "./components";
export const DamageTextQuery = With(PositionType, DamageTextType);
