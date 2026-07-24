import {
    QueryType,
    Types,
    With,
    type Component,
    type ComponentTag,
} from "@zero-ecs/game";

/** 示例宿主自己的 X/Y/Z Transform，不属于飞剑库。 */
export enum Transform3Field {
    X,
    Y,
    Z,
}

export class Transform3Type implements Component<Transform3Field> {
    readonly [Transform3Field.X] = Types.F32;
    readonly [Transform3Field.Y] = Types.F32;
    readonly [Transform3Field.Z] = Types.F32;
}

export class CultivatorTag implements ComponentTag {}

export const CultivatorQuery =
    QueryType.from(With(Transform3Type, CultivatorTag));
