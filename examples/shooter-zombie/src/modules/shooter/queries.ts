import { QueryType, With } from "@zero-ecs/game";
import { PositionType } from "../common";
import { ShooterType, ShotRequestType } from "./components";

export const ShooterQuery = QueryType.from(With(PositionType, ShooterType));
export const ShotRequestQuery = QueryType.from(With(ShotRequestType));
