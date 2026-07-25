import {
    State,
    type EntityAccess,
} from "@zero-ecs/game";

/** 伤害数字捕获系统复用的实体定位结果。 */
export class DamageDisplayAccessState extends State {
    readonly access: EntityAccess = {
        archetype: null,
        row: 0 as EntityAccess["row"],
    };
}
