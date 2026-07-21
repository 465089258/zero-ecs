import { Types, type Component } from "@zero-ecs/game";

export const enum DamageText { value, lifetime, floatY }

export class DamageTextType implements Component<DamageText> {
    readonly [DamageText.value] = Types.F32;
    readonly [DamageText.lifetime] = Types.F32;
    readonly [DamageText.floatY] = Types.F32;
}

