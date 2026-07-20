import { Types, type Component } from "@zero-ecs/game";

/** 由 Shooter-Projectile Integration 附着的伤害载荷；Projectile Core 不解释它。 */
export const enum ProjectileDamagePayload { amount }

export class ProjectileDamagePayloadType implements Component<ProjectileDamagePayload> {
    readonly [ProjectileDamagePayload.amount] = Types.F32;
}
