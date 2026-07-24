import {
    ManualStage,
    SystemSet,
} from "@zero-ecs/game";

/** 每个 requestAnimationFrame 显式运行一次的表现阶段。 */
export const FlyingSwordRender = new ManualStage("flying-sword:render", 10);

export const FlyingSwordRenderSet = Object.freeze({
    World: new SystemSet(FlyingSwordRender, "flying-sword:render:world"),
});
