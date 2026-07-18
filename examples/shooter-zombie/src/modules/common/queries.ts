import { QueryType, With } from "zero-ecs-lib";
import { GameEntityType } from "./components";

export const GameEntityQuery = QueryType.from(With(GameEntityType));
