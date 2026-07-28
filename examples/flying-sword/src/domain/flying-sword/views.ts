/** 飞剑示例本地领域实现。 */
import {
    QueryType,
    With,
    defineQueryProjection,
    type ComponentTag,
} from "@zero-ecs/game";
import {
    Direction3Type,
    Position3Type,
    PreviousPosition3Type,
} from "../../infrastructure/math";
import {
    FlyingSwordContactWindowStorage,
    FlyingSwordBehaviorStorage,
    FlyingSwordControlStorage,
    FlyingSwordFormationStorage,
    FlyingSwordFormationPlanStorage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupStorage,
    FlyingSwordGroupTarget3Storage,
    FlyingSwordMemberStorage,
    FlyingSwordSkillActionEntityStorage,
    FlyingSwordSkillActionStorage,
    FlyingSwordSkillProgressStorage,
    FlyingSwordSkillTarget3Storage,
    FlyingSwordSkillTimingStorage,
    FlyingSwordTaskStorage,
} from "./runtime/storage";
import type {
    FlyingSwordActionViewData,
    FlyingSwordBehaviorViewData,
    FlyingSwordControlViewData,
    FlyingSwordFormationViewData,
    FlyingSwordFormationPlanViewData,
    FlyingSwordGroupViewData,
    FlyingSwordMemberViewData,
    FlyingSwordSkillActionViewData,
    FlyingSwordSkillProgressViewData,
    FlyingSwordSkillTimingViewData,
    FlyingSwordVector3ViewData,
    FlyingSwordTaskViewData,
} from "./types";

/** 控制组公开只读投影；调用方不能借此修改内部存储。 */
export const FlyingSwordGroupView =
    defineQueryProjection<FlyingSwordGroupViewData>(
        FlyingSwordGroupStorage,
        "FlyingSwordGroupView",
    );

/** 控制组中心的公开只读投影。 */
export const FlyingSwordGroupCenter3View =
    defineQueryProjection<FlyingSwordVector3ViewData>(
        FlyingSwordGroupCenter3Storage,
        "FlyingSwordGroupCenter3View",
    );

/** 控制组基础目标的公开只读投影。 */
export const FlyingSwordGroupTarget3View =
    defineQueryProjection<FlyingSwordVector3ViewData>(
        FlyingSwordGroupTarget3Storage,
        "FlyingSwordGroupTarget3View",
    );

/** 控制组编队参数的公开只读投影。 */
export const FlyingSwordFormationView =
    defineQueryProjection<FlyingSwordFormationViewData>(
        FlyingSwordFormationStorage,
        "FlyingSwordFormationView",
    );

/** 控制组当前阵图计划的公开只读投影。 */
export const FlyingSwordFormationPlanView =
    defineQueryProjection<FlyingSwordFormationPlanViewData>(
        FlyingSwordFormationPlanStorage,
        "FlyingSwordFormationPlanView",
    );

/** 控制组基础模式的公开只读投影。 */
export const FlyingSwordControlView =
    defineQueryProjection<FlyingSwordControlViewData>(
        FlyingSwordControlStorage,
        "FlyingSwordControlView",
    );

/** 控制组常驻姿态和临时动态编队的公开只读投影。 */
export const FlyingSwordBehaviorView =
    defineQueryProjection<FlyingSwordBehaviorViewData>(
        FlyingSwordBehaviorStorage,
        "FlyingSwordBehaviorView",
    );

/** 飞剑领域身份的公开只读投影。 */
export const FlyingSwordView =
    defineQueryProjection<FlyingSwordMemberViewData>(
        FlyingSwordMemberStorage,
        "FlyingSwordView",
    );

/** 技能动作诊断与领域集成使用的只读投影。 */
export const FlyingSwordActionView =
    defineQueryProjection<FlyingSwordActionViewData>(
        FlyingSwordSkillActionStorage,
        "FlyingSwordActionView",
    );

/** 单把飞剑异步攻击任务的公开只读投影。 */
export const FlyingSwordTaskView =
    defineQueryProjection<FlyingSwordTaskViewData>(
        FlyingSwordTaskStorage,
        "FlyingSwordTaskView",
    );

/** 控制组级技能动作身份的公开只读投影。 */
export const FlyingSwordSkillActionView =
    defineQueryProjection<FlyingSwordSkillActionViewData>(
        FlyingSwordSkillActionEntityStorage,
        "FlyingSwordSkillActionView",
    );

/** 控制组级技能动作目标的公开只读投影。 */
export const FlyingSwordSkillTarget3View =
    defineQueryProjection<FlyingSwordVector3ViewData>(
        FlyingSwordSkillTarget3Storage,
        "FlyingSwordSkillTarget3View",
    );

/** 控制组级技能动作时序的公开只读投影。 */
export const FlyingSwordSkillTimingView =
    defineQueryProjection<FlyingSwordSkillTimingViewData>(
        FlyingSwordSkillTimingStorage,
        "FlyingSwordSkillTimingView",
    );

/** 控制组级技能动作进度的公开只读投影。 */
export const FlyingSwordSkillProgressView =
    defineQueryProjection<FlyingSwordSkillProgressViewData>(
        FlyingSwordSkillProgressStorage,
        "FlyingSwordSkillProgressView",
    );

/** 只选择当前开放攻击接触窗口的飞剑。 */
export const FlyingSwordContactWindow =
    defineQueryProjection<ComponentTag>(
        FlyingSwordContactWindowStorage,
        "FlyingSwordContactWindow",
    );

/** 飞剑当前位置的公开只读投影。 */
export const FlyingSwordPosition3View =
    defineQueryProjection(
        Position3Type,
        "FlyingSwordPosition3View",
    );

/** 飞剑上一固定帧位置的公开只读投影。 */
export const FlyingSwordPreviousPosition3View =
    defineQueryProjection(
        PreviousPosition3Type,
        "FlyingSwordPreviousPosition3View",
    );

/** 飞剑朝向的公开只读投影。 */
export const FlyingSwordDirection3View =
    defineQueryProjection(
        Direction3Type,
        "FlyingSwordDirection3View",
    );

/** 遍历全部飞剑控制组的公共查询。 */
export const FlyingSwordGroupQuery =
    QueryType.from(With(
        FlyingSwordGroupView,
        FlyingSwordGroupCenter3View,
        FlyingSwordGroupTarget3View,
        FlyingSwordFormationView,
        FlyingSwordControlView,
        FlyingSwordBehaviorView,
        FlyingSwordFormationPlanView,
    ));

/** 表现层所需的最小飞剑查询。 */
export const FlyingSwordQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordPreviousPosition3View,
    FlyingSwordPosition3View,
    FlyingSwordDirection3View,
));

/** 只遍历正在执行技能动作的飞剑。 */
export const FlyingSwordActionQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordActionView,
));

/** 遍历正在独立执行攻击任务的飞剑。 */
export const FlyingSwordTaskQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordTaskView,
));

/** 遍历独立攻击任务当前开放的接触窗口。 */
export const FlyingSwordTaskContactQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordTaskView,
    FlyingSwordContactWindow,
    FlyingSwordPreviousPosition3View,
    FlyingSwordPosition3View,
    FlyingSwordDirection3View,
));

/** 遍历控制组级技能动作实体。 */
export const FlyingSwordSkillActionQuery = QueryType.from(With(
    FlyingSwordSkillActionView,
    FlyingSwordSkillTarget3View,
    FlyingSwordSkillTimingView,
    FlyingSwordSkillProgressView,
));

/** 只遍历当前能够生成接触事实的飞剑。 */
export const FlyingSwordContactQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordContactWindow,
    FlyingSwordPreviousPosition3View,
    FlyingSwordPosition3View,
    FlyingSwordDirection3View,
));
