import {
    Commands,
    Inject,
    Service,
    World,
    type Entity,
} from "@zero-ecs/game";
import { FlyingSwordSkillCatalog } from "./skill-catalog";
import {
    FlyingSwordSkillPhase,
    FlyingSwordSkillPlanId,
    type ActivateFlyingSwordSkillOptions,
    type FlyingSwordSkillPhase as FlyingSwordSkillPhaseValue,
} from "./skill-types";
import { FlyingSwordSkillActionIndexState } from "./runtime/skill-action-state";
import {
    CancelFlyingSwordSkillRequest,
    CancelFlyingSwordSkillRequestStorage,
    CastFlyingSwordSkillRequest,
    CastFlyingSwordSkillRequestStorage,
    FlyingSwordSkillActionEntityStorage,
    FlyingSwordSkillTimingStorage,
    SetFlyingSwordSkillTargetRequest,
    SetFlyingSwordSkillTargetRequestStorage,
} from "./runtime/storage";
import {
    FlyingSwordSkillAction,
    FlyingSwordSkillTiming,
    type ReadonlyVector3,
} from "./types";

/** 飞剑技能激活、取消和只读状态查询入口。 */
export class FlyingSwordSkillService extends Service {
    @Inject.resource(FlyingSwordSkillCatalog)
    private readonly catalog!: FlyingSwordSkillCatalog;

    @Inject.service(Commands)
    private readonly commands!: Commands;

    @Inject.world()
    private readonly world!: World;

    @Inject.state(FlyingSwordSkillActionIndexState)
    private readonly actions!: FlyingSwordSkillActionIndexState;

    cast(options: ActivateFlyingSwordSkillOptions): void {
        const planId = options.planId ?? FlyingSwordSkillPlanId.PiercingCloud;
        this.catalog.require(planId);
        vector("target", options.target);
        this.commands
            .spawn()
            .add(CastFlyingSwordSkillRequestStorage)
            .set(
                CastFlyingSwordSkillRequestStorage,
                CastFlyingSwordSkillRequest.Group,
                options.group,
            )
            .set(
                CastFlyingSwordSkillRequestStorage,
                CastFlyingSwordSkillRequest.Plan,
                planId,
            )
            .set(
                CastFlyingSwordSkillRequestStorage,
                CastFlyingSwordSkillRequest.TargetX,
                options.target.x,
            )
            .set(
                CastFlyingSwordSkillRequestStorage,
                CastFlyingSwordSkillRequest.TargetY,
                options.target.y,
            )
            .set(
                CastFlyingSwordSkillRequestStorage,
                CastFlyingSwordSkillRequest.TargetZ,
                options.target.z,
            )
            .submit();
    }

    /**
     * 为一把飞剑的下一次技能动作指定独立目标点。
     *
     * 未调用该方法的飞剑继续使用 cast 的控制组目标。
     */
    setSkillTarget(sword: Entity, target: ReadonlyVector3): void {
        vector("target", target);
        this.commands
            .spawn()
            .add(SetFlyingSwordSkillTargetRequestStorage)
            .set(
                SetFlyingSwordSkillTargetRequestStorage,
                SetFlyingSwordSkillTargetRequest.Sword,
                sword,
            )
            .set(
                SetFlyingSwordSkillTargetRequestStorage,
                SetFlyingSwordSkillTargetRequest.TargetX,
                target.x,
            )
            .set(
                SetFlyingSwordSkillTargetRequestStorage,
                SetFlyingSwordSkillTargetRequest.TargetY,
                target.y,
            )
            .set(
                SetFlyingSwordSkillTargetRequestStorage,
                SetFlyingSwordSkillTargetRequest.TargetZ,
                target.z,
            )
            .submit();
    }

    cancel(group: Entity): void {
        this.commands
            .spawn()
            .add(CancelFlyingSwordSkillRequestStorage)
            .set(
                CancelFlyingSwordSkillRequestStorage,
                CancelFlyingSwordSkillRequest.Group,
                group,
            )
            .submit();
    }

    phase(group: Entity): FlyingSwordSkillPhaseValue {
        const action = this.actions.groupActions.get(group);
        if (action === undefined) return FlyingSwordSkillPhase.Idle;
        const phase = this.world.get(
            action,
            FlyingSwordSkillTimingStorage,
            FlyingSwordSkillTiming.DisplayPhase,
        );
        return phase === null
            ? FlyingSwordSkillPhase.Idle
            : phase as FlyingSwordSkillPhaseValue;
    }

    sequence(group: Entity): number {
        const action = this.actions.groupActions.get(group);
        if (action === undefined) return 0;
        return this.world.get(
            action,
            FlyingSwordSkillActionEntityStorage,
            FlyingSwordSkillAction.Sequence,
        ) ?? 0;
    }
}

function vector(
    name: string,
    value: Readonly<{ x: number; y: number; z: number }>,
): void {
    if (
        !Number.isFinite(value.x) ||
        !Number.isFinite(value.y) ||
        !Number.isFinite(value.z)
    ) {
        throw new RangeError(`${name} must contain finite coordinates`);
    }
}
