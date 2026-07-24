import {
    QueryType,
    With,
    defineQueryProjection,
} from "@zero-ecs/game";
import {
    FlyingSwordGroupStorage,
    FlyingSwordStorage,
} from "./runtime/storage";
import type {
    FlyingSwordGroupViewData,
    FlyingSwordViewData,
} from "./types";

/** 控制组公开只读投影；调用方不能借此修改内部存储。 */
export const FlyingSwordGroupView =
    defineQueryProjection<FlyingSwordGroupViewData>(
        FlyingSwordGroupStorage,
        "FlyingSwordGroupView",
    );

/** 飞剑公开只读投影；用于表现和宿主集成。 */
export const FlyingSwordView =
    defineQueryProjection<FlyingSwordViewData>(
        FlyingSwordStorage,
        "FlyingSwordView",
    );

/** 遍历全部飞剑控制组的公共查询。 */
export const FlyingSwordGroupQuery =
    QueryType.from(With(FlyingSwordGroupView));

/** 遍历全部已出鞘飞剑的公共查询。 */
export const FlyingSwordQuery =
    QueryType.from(With(FlyingSwordView));
