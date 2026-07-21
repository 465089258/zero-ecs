import { ManualStage, SystemSet } from "@zero-ecs/game";

/** 宿主每个显示帧显式执行一次，不属于固定模拟 Tick。 */
export const Render = new ManualStage("shooter:render", 10);

/** 后端无关的绘制层协议。 */
export const RenderSet = Object.freeze({
    prepare: new SystemSet(Render, "render:prepare"),
    background: new SystemSet(Render, "render:background"),
    worldBack: new SystemSet(Render, "render:world-back"),
    world: new SystemSet(Render, "render:world"),
    worldFront: new SystemSet(Render, "render:world-front"),
    effects: new SystemSet(Render, "render:effects"),
    hud: new SystemSet(Render, "render:hud"),
    finish: new SystemSet(Render, "render:finish"),
});
