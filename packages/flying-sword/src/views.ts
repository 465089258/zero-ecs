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
} from "@zero-ecs/math/3d";
import {
    FlyingSwordContactWindowStorage,
    FlyingSwordGroupStorage,
    FlyingSwordMemberStorage,
    FlyingSwordSkillActionStorage,
} from "./runtime/storage";
import type {
    FlyingSwordActionViewData,
    FlyingSwordGroupViewData,
    FlyingSwordMemberViewData,
} from "./types";

/** 控制组公开只读投影；调用方不能借此修改内部存储。 */
export const FlyingSwordGroupView =
    defineQueryProjection<FlyingSwordGroupViewData>(
        FlyingSwordGroupStorage,
        "FlyingSwordGroupView",
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
    QueryType.from(With(FlyingSwordGroupView));

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

/** 只遍历当前能够生成接触事实的飞剑。 */
export const FlyingSwordContactQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordContactWindow,
    FlyingSwordPreviousPosition3View,
    FlyingSwordPosition3View,
    FlyingSwordDirection3View,
));
