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
    PreviousX,
    PreviousY,
    PreviousZ,
}

export class Transform3Type implements Component<Transform3Field> {
    readonly [Transform3Field.X] = Types.F32;
    readonly [Transform3Field.Y] = Types.F32;
    readonly [Transform3Field.Z] = Types.F32;
    readonly [Transform3Field.PreviousX] = Types.F32;
    readonly [Transform3Field.PreviousY] = Types.F32;
    readonly [Transform3Field.PreviousZ] = Types.F32;
}

export class CultivatorTag implements ComponentTag {}

/** 角色在 X/Z 地面上的点击移动状态。 */
export enum CultivatorMovementField {
    TargetX,
    TargetZ,
    Speed,
    StoppingDistance,
    Moving,
}

export class CultivatorMovementType implements Component<CultivatorMovementField> {
    readonly [CultivatorMovementField.TargetX] = Types.F32;
    readonly [CultivatorMovementField.TargetZ] = Types.F32;
    readonly [CultivatorMovementField.Speed] = Types.F32;
    readonly [CultivatorMovementField.StoppingDistance] = Types.F32;
    readonly [CultivatorMovementField.Moving] = Types.U8;
}

export const CultivatorQuery =
    QueryType.from(With(Transform3Type, CultivatorTag));

export const CultivatorMovementQuery = QueryType.from(With(
    Transform3Type,
    CultivatorMovementType,
    CultivatorTag,
));
