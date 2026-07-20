import { Types, type Component } from "zero-ecs-lib";
export const enum DamageText { value, lifetime, floatY, isCrit }
export class DamageTextType implements Component<DamageText> {
    readonly [DamageText.value] = Types.F32;
    readonly [DamageText.lifetime] = Types.F32;
    readonly [DamageText.floatY] = Types.F32;
    readonly [DamageText.isCrit] = Types.U8;
}
