import { Stage, SystemSet } from "@zero-ecs/scheduler";

/**
 * 由宿主显式驱动的扩展阶段；不会被 Game.update() 自动执行。
 * 私有类型品牌防止把标准 Update/Startup/Shutdown 阶段传给 runStage()。
 */
export class ManualStage extends Stage {
    private declare readonly manualStageBrand: void;
}

/** Game 启动时执行一次。 */
export const Startup = new Stage("startup", -100);

/** Game 固定 Tick 的标准阶段。 */
export class Update {
    static readonly first = new Stage("first", 0);
    static readonly fixed = new Stage("fixed", 1);
    static readonly last = new Stage("last", 2);
    static readonly post = new Stage("post", 3);
    static readonly stages = Object.freeze([
        Update.first,
        Update.fixed,
        Update.last,
        Update.post,
    ]);
}

/** Game 停止时执行一次。 */
export const Shutdown = new Stage("shutdown", 100);

/** 可选功能与上层 Module 共享的稳定排序锚点。 */
export const GameSystemSet = Object.freeze({
    Commands: new SystemSet(Update.post, "commands"),
    Structure: new SystemSet(Update.post, "structure"),
    Events: new SystemSet(Update.post, "events"),
    TimerAdvance: new SystemSet(Update.fixed, "timer:advance"),
    TimerCallbacks: new SystemSet(Update.post, "timer:callbacks"),
});
