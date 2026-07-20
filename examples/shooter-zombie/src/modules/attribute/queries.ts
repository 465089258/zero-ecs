import { QueryType, With } from "@zero-ecs/game";
import { AttributeChangeRequestType, HealthType } from "./components";

export const HealthQuery = QueryType.from(With(HealthType));
export const AttributeChangeRequestQuery = QueryType.from(With(AttributeChangeRequestType));
