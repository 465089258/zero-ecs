import {
    QueryType,
    With,
} from "@zero-ecs/game";
import {
    FlyingSwordActionView,
    FlyingSwordContactWindow,
    FlyingSwordDirection3View,
    FlyingSwordPosition3View,
    FlyingSwordPreviousPosition3View,
    FlyingSwordView,
} from "@zero-ecs/flying-sword";
import {
    Direction3Type,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
} from "@zero-ecs/math/3d";
import { MoveTowards3Type } from "@zero-ecs/motion/3d";
import { CultivatorTag } from "../components";
import {
    AutoFlyingSwordSkillType,
    ChooseUpgradeRequestType,
    DamageRequestType,
    EnemyBodyType,
    EnemyCombatType,
    EnemyDirectorType,
    EnemyIdentityType,
    ExperiencePickupType,
    ExperienceRewardType,
    FlyingSwordHitMemoryType,
    HealthType,
    LevelExperienceType,
    PlayerMovementType,
    PlayerPickupType,
    RogueRunClockType,
    RogueRunIdentityType,
    RogueRunRandomType,
    RogueRunStatisticsType,
    RogueRunStatusType,
    RogueRunTargetType,
    UpgradeSelectionType,
} from "./components";

export const RogueRunQuery = QueryType.from(With(
    RogueRunIdentityType,
    RogueRunClockType,
    RogueRunStatusType,
    RogueRunRandomType,
    RogueRunStatisticsType,
    EnemyDirectorType,
    RogueRunTargetType,
    UpgradeSelectionType,
));

export const RoguePlayerQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
    Direction3Type,
    MoveTowards3Type,
    CultivatorTag,
    HealthType,
    PlayerMovementType,
    LevelExperienceType,
    PlayerPickupType,
));

export const RogueEnemyQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
    Direction3Type,
    MoveTowards3Type,
    EnemyIdentityType,
    EnemyBodyType,
    EnemyCombatType,
    HealthType,
    ExperienceRewardType,
    FlyingSwordHitMemoryType,
));

export const RogueEnemyRenderQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    EnemyIdentityType,
    EnemyBodyType,
    HealthType,
));

export const RogueExperiencePickupQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
    ExperiencePickupType,
));

export const RogueDamageRequestQuery = QueryType.from(With(
    DamageRequestType,
));

export const RogueAutoFlyingSwordGroupQuery = QueryType.from(With(
    AutoFlyingSwordSkillType,
));

export const RogueChooseUpgradeRequestQuery = QueryType.from(With(
    ChooseUpgradeRequestType,
));

/** Integration 专用：公共飞剑投影 + 动作身份，不依赖飞剑内部 Storage。 */
export const RogueFlyingSwordContactQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordActionView,
    FlyingSwordContactWindow,
    FlyingSwordPreviousPosition3View,
    FlyingSwordPosition3View,
    FlyingSwordDirection3View,
));
