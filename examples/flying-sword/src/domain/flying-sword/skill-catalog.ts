/** 飞剑示例本地领域实现。 */
import { Resource } from "@zero-ecs/game";
import {
    FlyingSwordSkillPlanId,
    type CompiledFlyingSwordSkillPlan,
} from "./skill-types";

/** “御剑诀·穿云”的首个编译计划。 */
export const PiercingCloudSkillPlan: CompiledFlyingSwordSkillPlan =
    Object.freeze({
        id: FlyingSwordSkillPlanId.PiercingCloud,
        minimumSwords: 1,
        maximumSwords: 0xffff,
        gatherTicks: 1,
        gatherArrivalRatio: 1,
        gatherDistance: 0,
        gatherHeight: 0,
        gatherSpacing: 0.28,
        gatherArrivalRadius: 0.42,
        gatherSpeedMultiplier: 1,
        launchWaveCount: 1,
        launchIntervalTicks: 0,
        launchCurveTicks: 1,
        launchLookaheadTicks: 1,
        launchAscentHeight: 0,
        launchTurnDistance: 0,
        launchTimeoutTicks: 90,
        launchSpeedMultiplier: 2.25,
        strikeHeight: 0,
        strikeSpread: 0,
        passDistance: 1.8,
        strikeTicks: 4,
        strikeSpeedMultiplier: 2.25,
        returnSpeedMultiplier: 1.25,
        rejoinRadius: 1.35,
        rejoinTicks: 2,
        actionTimeoutTicks: 360,
    });

/**
 * 编译飞剑技能计划的只读目录。
 *
 * 自定义内容在创建 FlyingSwordModule 时注入，稳定帧按数字 id 直接索引。
 */
export class FlyingSwordSkillCatalog extends Resource {
    private readonly plans: Array<CompiledFlyingSwordSkillPlan | undefined> = [];

    constructor(
        definitions: readonly CompiledFlyingSwordSkillPlan[] = [],
    ) {
        super();
        for (let index = 0; index < DEFAULT_SKILL_PLANS.length; index++) {
            this.add(DEFAULT_SKILL_PLANS[index]);
        }
        for (let index = 0; index < definitions.length; index++) {
            this.add(definitions[index]);
        }
    }

    get(id: number): CompiledFlyingSwordSkillPlan | undefined {
        return this.plans[id];
    }

    require(id: number): CompiledFlyingSwordSkillPlan {
        const plan = this.get(id);
        if (!plan) throw new RangeError(`Unknown flying sword skill plan: ${id}`);
        return plan;
    }

    private add(plan: CompiledFlyingSwordSkillPlan): void {
        validatePlan(plan);
        if (this.plans[plan.id]) {
            throw new Error(`Duplicate flying sword skill plan: ${plan.id}`);
        }
        this.plans[plan.id] = Object.isFrozen(plan)
            ? plan
            : Object.freeze({ ...plan });
    }
}

const DEFAULT_SKILL_PLANS = Object.freeze([PiercingCloudSkillPlan]);

function validatePlan(plan: CompiledFlyingSwordSkillPlan): void {
    integer("id", plan.id, 1, 0xffff);
    integer("minimumSwords", plan.minimumSwords, 1, 0xffff);
    integer("maximumSwords", plan.maximumSwords, plan.minimumSwords, 0xffff);
    integer("gatherTicks", plan.gatherTicks, 1, 0xffffffff);
    ratio("gatherArrivalRatio", plan.gatherArrivalRatio);
    nonNegative("gatherDistance", plan.gatherDistance);
    finite("gatherHeight", plan.gatherHeight);
    positive("gatherSpacing", plan.gatherSpacing);
    positive("gatherArrivalRadius", plan.gatherArrivalRadius);
    positive("gatherSpeedMultiplier", plan.gatherSpeedMultiplier);
    integer("launchWaveCount", plan.launchWaveCount, 1, 0xffff);
    integer("launchIntervalTicks", plan.launchIntervalTicks, 0, 0xffffffff);
    integer("launchCurveTicks", plan.launchCurveTicks, 1, 0xffffffff);
    integer(
        "launchLookaheadTicks",
        plan.launchLookaheadTicks,
        0,
        plan.launchCurveTicks,
    );
    nonNegative("launchAscentHeight", plan.launchAscentHeight);
    nonNegative("launchTurnDistance", plan.launchTurnDistance);
    integer("launchTimeoutTicks", plan.launchTimeoutTicks, 1, 0xffffffff);
    positive("launchSpeedMultiplier", plan.launchSpeedMultiplier);
    finite("strikeHeight", plan.strikeHeight);
    nonNegative("strikeSpread", plan.strikeSpread);
    positive("passDistance", plan.passDistance);
    integer("strikeTicks", plan.strikeTicks, 1, 0xffffffff);
    positive("strikeSpeedMultiplier", plan.strikeSpeedMultiplier);
    positive("returnSpeedMultiplier", plan.returnSpeedMultiplier);
    positive("rejoinRadius", plan.rejoinRadius);
    integer("rejoinTicks", plan.rejoinTicks, 0, 0xffffffff);
    integer("actionTimeoutTicks", plan.actionTimeoutTicks, 1, 0xffffffff);
}

function finite(name: string, value: number): void {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function positive(name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a finite positive number`);
    }
}

function nonNegative(name: string, value: number): void {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be finite and non-negative`);
    }
}

function ratio(name: string, value: number): void {
    if (!Number.isFinite(value) || value <= 0 || value > 1) {
        throw new RangeError(`${name} must be in (0, 1]`);
    }
}

function integer(
    name: string,
    value: number,
    minimum: number,
    maximum: number,
): void {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new RangeError(`${name} must be an integer in [${minimum}, ${maximum}]`);
    }
}
