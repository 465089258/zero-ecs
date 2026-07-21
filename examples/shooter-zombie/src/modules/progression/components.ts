import { Types, type Component, type ComponentTag } from "@zero-ecs/game";

export const enum ExpOrb { value, radius, active }

export class ExpOrbType implements Component<ExpOrb> {
    readonly [ExpOrb.value] = Types.F32;
    readonly [ExpOrb.radius] = Types.F32;
    readonly [ExpOrb.active] = Types.U8;
}

/** Progression 自己定义的收集者角色；不依赖 ShooterType。 */
export class ExperienceCollectorType implements ComponentTag {}
