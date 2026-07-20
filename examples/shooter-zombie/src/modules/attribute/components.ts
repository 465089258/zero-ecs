import { Types, type Component } from "@zero-ecs/game";

/** 属性模块的运行时输入：任何实体都可以拥有生命值。 */
export const enum Health { current, max }

export class HealthType implements Component<Health> {
    readonly [Health.current] = Types.F32;
    readonly [Health.max] = Types.F32;
}

/** 外部模块只能请求变化，不直接了解 Health 的存储与约束规则。 */
export const enum AttributeChangeRequest { target, amount }

export class AttributeChangeRequestType implements Component<AttributeChangeRequest> {
    readonly [AttributeChangeRequest.target] = Types.U32;
    readonly [AttributeChangeRequest.amount] = Types.F32;
}
