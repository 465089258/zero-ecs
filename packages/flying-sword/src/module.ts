import type { GameBuilder, Module } from "@zero-ecs/game";
import { FlyingSwordService } from "./service";
import { FlyingSwordSkillCatalog } from "./skill-catalog";
import { FlyingSwordSkillService } from "./skill-service";
import { FlyingSwordRequestState } from "./runtime/request-state";
import { FlyingSwordRuntimeState } from "./runtime/runtime-state";
import { FlyingSwordSkillActionState } from "./runtime/skill-action-state";
import { FlyingSwordSkillRequestState } from "./runtime/skill-request-state";
import {
    FlyingSwordSkillSystemOptions,
    acquireFlyingSwordSkillsSystem,
    applyFlyingSwordSkillRequestsSystem,
    cleanupFlyingSwordSkillsSystem,
    guideFlyingSwordSkillsSystem,
    resolveFlyingSwordSkillsSystem,
} from "./runtime/skill-systems";
import {
    FlyingSwordSystemOptions,
    applyFlyingSwordRequestsSystem,
    formFlyingSwordGoalsSystem,
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
    constructor(
        private readonly skillCatalog = new FlyingSwordSkillCatalog(),
    ) {}

    build(builder: GameBuilder): void {
        builder
            .addResource(FlyingSwordSkillCatalog, this.skillCatalog)
            .addState(FlyingSwordRequestState)
            .addState(FlyingSwordRuntimeState)
            .addState(FlyingSwordSkillRequestState)
            .addState(FlyingSwordSkillActionState)
            .addService(FlyingSwordService)
            .addService(FlyingSwordSkillService);

        builder.addSystem(
            applyFlyingSwordRequestsSystem,
            FlyingSwordSystemOptions.requests,
        );
        builder.addSystem(
            applyFlyingSwordSkillRequestsSystem,
            FlyingSwordSkillSystemOptions.requests,
        );
        builder.addSystem(
            synchronizeFlyingSwordGroupsSystem,
            FlyingSwordSystemOptions.groups,
        );
        builder.addSystem(
            acquireFlyingSwordSkillsSystem,
            FlyingSwordSkillSystemOptions.acquire,
        );
        builder.addSystem(
            formFlyingSwordGoalsSystem,
            FlyingSwordSystemOptions.formation,
        );
        builder.addSystem(
            guideFlyingSwordSkillsSystem,
            FlyingSwordSkillSystemOptions.guidance,
        );
        builder.addSystem(
            moveFlyingSwordsSystem,
            FlyingSwordSystemOptions.motion,
        );
        builder.addSystem(
            resolveFlyingSwordSkillsSystem,
            FlyingSwordSkillSystemOptions.contact,
        );
        builder.addSystem(
            cleanupFlyingSwordSkillsSystem,
            FlyingSwordSkillSystemOptions.cleanup,
        );
    }
}
