import {
    QueryType,
    With,
    type ComponentTag,
} from "@zero-ecs/game";
import {
    Position3Type,
    PreviousPosition3Type,
} from "../infrastructure/math";
import { MoveTowards3Type } from "../infrastructure/motion";

export class CultivatorTag implements ComponentTag {}

/** 鼠标移动目标尚未到达时才存在。 */
export class CultivatorMoveActiveTag implements ComponentTag {}

export const CultivatorQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    CultivatorTag,
));

export const CultivatorControlQuery = QueryType.from(With(
    Position3Type,
    MoveTowards3Type,
    CultivatorTag,
));

export const MovingCultivatorQuery = QueryType.from(With(
    Position3Type,
    MoveTowards3Type,
    CultivatorMoveActiveTag,
    CultivatorTag,
));
