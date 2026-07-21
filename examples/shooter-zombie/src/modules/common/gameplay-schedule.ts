import { SystemSet, Update } from "@zero-ecs/game";

/**
 * 模块共享的调度协议。模块只依赖阶段语义，不依赖其他模块的具体系统函数。
 */
export const GameplaySet = Object.freeze({
    lifecycle: new SystemSet(Update.fixed, "shooter:lifecycle"),
    spawn: new SystemSet(Update.fixed, "shooter:spawn"),
    intent: new SystemSet(Update.fixed, "shooter:intent"),
    projectile: new SystemSet(Update.fixed, "shooter:projectile"),
    collision: new SystemSet(Update.fixed, "shooter:collision"),
    damage: new SystemSet(Update.fixed, "shooter:damage"),
    attributeRequest: new SystemSet(Update.fixed, "shooter:attribute-request"),
    attribute: new SystemSet(Update.fixed, "shooter:attribute"),
    reaction: new SystemSet(Update.fixed, "shooter:reaction"),
    feedback: new SystemSet(Update.fixed, "shooter:feedback"),
    progression: new SystemSet(Update.fixed, "shooter:progression"),
    progressionInput: new SystemSet(Update.fixed, "shooter:progression-input"),
    statistics: new SystemSet(Update.fixed, "shooter:statistics"),
});
