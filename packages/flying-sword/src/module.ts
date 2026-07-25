import type { GameBuilder, Module } from "@zero-ecs/game";
import { FlyingSwordService } from "./service";
import { FlyingSwordSkillCatalog } from "./skill-catalog";
import { FlyingSwordSkillService } from "./skill-service";
import { FlyingSwordEntityAccessState } from "./runtime/access-state";
import { FlyingSwordGroupIndexState } from "./runtime/runtime-state";
import {
    FlyingSwordSkillActionIndexState,
    FlyingSwordSkillSequenceState,
} from "./runtime/skill-action-state";
import {
    FlyingSwordSkillSystemOptions,
    acquireFlyingSwordSkillsSystem,
    applyFlyingSwordSkillTargetRequestsSystem,
    applyFlyingSwordSkillRequestsSystem,
    cleanupFlyingSwordSkillsSystem,
    guideFlyingSwordSkillsSystem,
    resolveFlyingSwordSkillsSystem,
    snapshotFlyingSwordSkillActionsSystem,
} from "./runtime/skill-systems";
import {
    FlyingSwordSystemOptions,
    applyFlyingSwordCenterRequestsSystem,
    applyFlyingSwordFormationSizeRequestsSystem,
    applyFlyingSwordActiveFormationRequestsSystem,
    applyFlyingSwordFocusRequestsSystem,
    applyFlyingSwordModeRequestsSystem,
    applyFlyingSwordStanceRequestsSystem,
    formFlyingSwordGoalsSystem,
    orientIdleFlyingSwordsSystem,
    snapshotFlyingSwordGroupsSystem,
} from "./runtime/systems";
import {
    FlyingSwordTaskSystemOptions,
    applyFlyingSwordTaskRequestsSystem,
    guideFlyingSwordTasksSystem,
} from "./runtime/task-systems";
import { FlyingSwordTaskCancellationState } from "./runtime/task-state";

/**
 * 安装飞剑领域基础运行时。
 *
 * 宿主需要同时安装 CommandModule、TimeModule 和 Motion3Module。
 * 控制组中心由宿主 Integration 写入 FlyingSwordService.setCenter。
 */
export class FlyingSwordModule implements Module {
    constructor(
        private readonly skillCatalog = new FlyingSwordSkillCatalog(),
    ) {}

    build(builder: GameBuilder): void {
        builder
            .addResource(FlyingSwordSkillCatalog, this.skillCatalog)
            .addState(FlyingSwordEntityAccessState)
            .addState(FlyingSwordGroupIndexState)
            .addState(FlyingSwordSkillActionIndexState)
            .addState(FlyingSwordSkillSequenceState)
            .addState(FlyingSwordTaskCancellationState)
            .addService(FlyingSwordService)
            .addService(FlyingSwordSkillService);

        const centerRequests = builder.addSystem(
            applyFlyingSwordCenterRequestsSystem,
            FlyingSwordSystemOptions.centerRequests,
        );
        const focusRequests = builder.addSystem(
            applyFlyingSwordFocusRequestsSystem,
            FlyingSwordSystemOptions.focusRequests,
        );
        const modeRequests = builder.addSystem(
            applyFlyingSwordModeRequestsSystem,
            FlyingSwordSystemOptions.modeRequests,
        );
        const formationSizeRequests = builder.addSystem(
            applyFlyingSwordFormationSizeRequestsSystem,
            FlyingSwordSystemOptions.formationSizeRequests,
        );
        const stanceRequests = builder.addSystem(
            applyFlyingSwordStanceRequestsSystem,
            FlyingSwordSystemOptions.stanceRequests,
        );
        const activeFormationRequests = builder.addSystem(
            applyFlyingSwordActiveFormationRequestsSystem,
            FlyingSwordSystemOptions.activeFormationRequests,
        );
        const taskRequests = builder.addSystem(
            applyFlyingSwordTaskRequestsSystem,
            FlyingSwordTaskSystemOptions.requests,
        );
        const actionIndex = builder.addSystem(
            snapshotFlyingSwordSkillActionsSystem,
            FlyingSwordSkillSystemOptions.actionIndex,
        );
        const skillTargetRequests = builder.addSystem(
            applyFlyingSwordSkillTargetRequestsSystem,
            FlyingSwordSkillSystemOptions.targetRequests,
        );
        const skillRequests = builder.addSystem(
            applyFlyingSwordSkillRequestsSystem,
            FlyingSwordSkillSystemOptions.requests,
        );
        builder.chain(
            centerRequests,
            focusRequests,
            modeRequests,
            formationSizeRequests,
            stanceRequests,
            activeFormationRequests,
            taskRequests,
            actionIndex,
            skillTargetRequests,
            skillRequests,
        );
        builder.addSystem(
            snapshotFlyingSwordGroupsSystem,
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
            guideFlyingSwordTasksSystem,
            FlyingSwordTaskSystemOptions.guidance,
        );
        builder.addSystem(
            orientIdleFlyingSwordsSystem,
            FlyingSwordSystemOptions.orientation,
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
