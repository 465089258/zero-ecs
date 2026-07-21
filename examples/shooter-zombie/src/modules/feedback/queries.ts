import { QueryType, With } from "@zero-ecs/game";
import { PositionType } from "../common";
import { DamageTextType } from "./components";

export const DamageTextQuery = QueryType.from(With(PositionType, DamageTextType));
