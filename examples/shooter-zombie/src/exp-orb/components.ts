import { Types, type Component } from "zero-ecs-lib";
export const enum ExpOrb { value, speed, active }
export class ExpOrbType implements Component<ExpOrb> {
    readonly [ExpOrb.value] = Types.F32;
    readonly [ExpOrb.speed] = Types.F32;
    readonly [ExpOrb.active] = Types.U8;
}
