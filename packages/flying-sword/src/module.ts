import type { GameBuilder, Module } from "@zero-ecs/game";
import { FlyingSwordService } from "./service";
import { FlyingSwordRequestState } from "./runtime/request-state";
import { FlyingSwordRuntimeState } from "./runtime/runtime-state";
import {
    FlyingSwordSystemOptions,
    applyFlyingSwordRequestsSystem,
    moveFlyingSwordsSystem,
    synchronizeFlyingSwordGroupsSystem,
} from "./runtime/systems";

/**
 * 安装飞剑领域基础运行时。
 *
 * 宿主需要同时安装 CommandModule、TimeModule，并注册
 * FlyingSwordSpatialService 的具体实现。
 */
export class FlyingSwordModule implements Module {
    build(builder: GameBuilder): void {
        builder
            .addState(FlyingSwordRequestState)
            .addState(FlyingSwordRuntimeState)
            .addService(FlyingSwordService);

        builder.addSystem(
            applyFlyingSwordRequestsSystem,
            FlyingSwordSystemOptions.requests,
        );
        builder.addSystem(
            synchronizeFlyingSwordGroupsSystem,
            FlyingSwordSystemOptions.groups,
        );
        builder.addSystem(
            moveFlyingSwordsSystem,
            FlyingSwordSystemOptions.motion,
        );
    }
}
