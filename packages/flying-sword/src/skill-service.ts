import {
    Inject,
    Service,
    type Entity,
} from "@zero-ecs/game";
import { FlyingSwordSkillCatalog } from "./skill-catalog";
import {
    FlyingSwordSkillPhase,
    FlyingSwordSkillPlanId,
    type ActivateFlyingSwordSkillOptions,
    type FlyingSwordSkillPhase as FlyingSwordSkillPhaseValue,
} from "./skill-types";
import { FlyingSwordSkillActionState } from "./runtime/skill-action-state";
import { FlyingSwordSkillRequestState } from "./runtime/skill-request-state";

/** 飞剑技能激活、取消和只读状态查询入口。 */
export class FlyingSwordSkillService extends Service {
    @Inject.resource(FlyingSwordSkillCatalog)
    private readonly catalog!: FlyingSwordSkillCatalog;

    @Inject.state(FlyingSwordSkillRequestState)
    private readonly requests!: FlyingSwordSkillRequestState;

    @Inject.state(FlyingSwordSkillActionState)
    private readonly actions!: FlyingSwordSkillActionState;

    cast(options: ActivateFlyingSwordSkillOptions): void {
        const planId = options.planId ?? FlyingSwordSkillPlanId.PiercingCloud;
        this.catalog.require(planId);
        vector("target", options.target);
        this.requests.activate(
            options.group,
            planId,
            options.target.x,
            options.target.y,
            options.target.z,
        );
    }

    cancel(group: Entity): void {
        this.requests.cancel(group);
    }

    phase(group: Entity): FlyingSwordSkillPhaseValue {
        const index = this.actions.indices.get(group);
        return index === undefined
            ? FlyingSwordSkillPhase.Idle
            : this.actions.displayPhases[index] as FlyingSwordSkillPhaseValue;
    }

    sequence(group: Entity): number {
        const index = this.actions.indices.get(group);
        return index === undefined ? 0 : this.actions.sequences[index];
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
