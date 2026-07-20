import { QueryType, With } from "@zero-ecs/game";
import { DamageRequestType, DamageResultType } from "./components";

export const DamageRequestQuery = QueryType.from(With(DamageRequestType));
export const DamageResultQuery = QueryType.from(With(DamageResultType));
