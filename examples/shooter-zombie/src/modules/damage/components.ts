import { Types, type Component } from "@zero-ecs/game";

/** Damage 模块定义的输入契约。请求来源可以是投射物、Buff、陷阱或其他机制。 */
export const enum DamageRequest { source, target, amount, x, y }

export class DamageRequestType implements Component<DamageRequest> {
    readonly [DamageRequest.source] = Types.Entity;
    readonly [DamageRequest.target] = Types.Entity;
    readonly [DamageRequest.amount] = Types.F32;
    readonly [DamageRequest.x] = Types.F32;
    readonly [DamageRequest.y] = Types.F32;
}

/** Damage 只计算伤害结果，不直接修改生命值。 */
export const enum DamageResult { source, target, requested, final, x, y }

export class DamageResultType implements Component<DamageResult> {
    readonly [DamageResult.source] = Types.Entity;
    readonly [DamageResult.target] = Types.Entity;
    readonly [DamageResult.requested] = Types.F32;
    readonly [DamageResult.final] = Types.F32;
    readonly [DamageResult.x] = Types.F32;
    readonly [DamageResult.y] = Types.F32;
}
