import { Types, type Component } from "@zero-ecs/game";

export const enum ExpOrb { value, radius, active }

export class ExpOrbType implements Component<ExpOrb> {
    readonly [ExpOrb.value] = Types.F32;
    readonly [ExpOrb.radius] = Types.F32;
    readonly [ExpOrb.active] = Types.U8;
}

export const enum DamageText { value, lifetime, floatY }

export class DamageTextType implements Component<DamageText> {
    readonly [DamageText.value] = Types.F32;
    readonly [DamageText.lifetime] = Types.F32;
    readonly [DamageText.floatY] = Types.F32;
}
