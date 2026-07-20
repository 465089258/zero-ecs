import { QueryType, With } from "@zero-ecs/game";
import { GameEntityType } from "./components";

export const GameEntityQuery = QueryType.from(With(GameEntityType));
