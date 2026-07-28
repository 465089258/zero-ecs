import {
    All,
    QueryType,
    With,
    Without,
} from "@zero-ecs/game";
import { Position3Type } from "../infrastructure/math";
import { DamageRequestType } from "../simulation/rogue/components";
import {
    DamageDisplayCapturedTag,
    DamageDisplayType,
} from "./components";

export const DamageDisplaySourceQuery = QueryType.from(All(
    With(DamageRequestType),
    Without(DamageDisplayCapturedTag),
));

export const DamageDisplayQuery = QueryType.from(With(
    Position3Type,
    DamageDisplayType,
));
