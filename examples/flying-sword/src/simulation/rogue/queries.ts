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
    FlyingSwordTaskView,
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
    ColdSwordIntentType,
    DamageRequestType,
    EnemyBodyType,
    EnemyCombatType,
    EnemyColdAccumulationType,
    EnemyDirectorType,
    EnemyFeedbackType,
    EnemyIdentityType,
    ExperiencePickupType,
    ExperienceRewardType,
    FireBurstType,
    FireSwordIntentType,
    FlyingSwordCombatType,
    FlyingSwordContactCooldownType,
    FlyingSwordDamageSourceType,
    FlyingSwordPiercingSequenceType,
    FocusSwordHitHistoryType,
    HealthType,
    LevelExperienceType,
    LightningArcEnd3Type,
    LightningArcStart3Type,
    LightningArcType,
    LightningSwordIntentType,
    MetalSwordIntentType,
    PiercingDamageType,
    PlayerMovementType,
    PlayerPickupType,
    PlayerStaminaType,
    RogueRunClockType,
    RogueRunIdentityType,
    RogueRunRandomType,
    RogueRunStatisticsType,
    RogueRunStatusType,
    RogueRunTargetType,
    UpgradeSelectionType,
    SwordBodyUnityType,
    SwordBodyUnityPiercingSequenceType,
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
    SwordBodyUnityType,
    PlayerStaminaType,
));

/** 输入层驱动身剑合一时使用的窄查询。 */
export const SwordBodyUnityControlQuery = QueryType.from(With(
    Position3Type,
    MoveTowards3Type,
    Velocity3Type,
    CultivatorTag,
    PlayerMovementType,
    PlayerStaminaType,
    SwordBodyUnityType,
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
    FlyingSwordContactCooldownType,
    FocusSwordHitHistoryType,
));

export const RogueEnemyRenderQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    EnemyIdentityType,
    EnemyBodyType,
    HealthType,
    EnemyFeedbackType,
    EnemyColdAccumulationType,
));

/** 战斗快照只写表现反馈列，避免依赖敌人的完整玩法组件集合。 */
export const RogueEnemyFeedbackQuery = QueryType.from(With(
    EnemyFeedbackType,
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

export const RogueFlyingSwordDamageRequestQuery = QueryType.from(With(
    DamageRequestType,
    FlyingSwordDamageSourceType,
));

export const RoguePiercingFlyingSwordDamageRequestQuery =
    QueryType.from(With(
        DamageRequestType,
        FlyingSwordDamageSourceType,
        PiercingDamageType,
    ));

export const RogueAutoFlyingSwordGroupQuery = QueryType.from(With(
    AutoFlyingSwordSkillType,
    LightningSwordIntentType,
    MetalSwordIntentType,
    FireSwordIntentType,
    ColdSwordIntentType,
));

export const RogueLightningArcQuery = QueryType.from(With(
    LightningArcType,
    LightningArcStart3Type,
    LightningArcEnd3Type,
));

export const RogueFireBurstQuery = QueryType.from(With(
    Position3Type,
    FireBurstType,
));

export const RogueColdEnemyQuery = QueryType.from(With(
    EnemyBodyType,
    MoveTowards3Type,
    EnemyColdAccumulationType,
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
    FlyingSwordCombatType,
    FlyingSwordPiercingSequenceType,
));

/** 身剑合一的核心贯穿线，不把附属螺旋剑误算为同一直线。 */
export const RogueSwordBodyUnityContactQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    CultivatorTag,
    SwordBodyUnityType,
    SwordBodyUnityPiercingSequenceType,
));

/** 示例玩法所需的全部飞剑及其宿主侧战斗状态。 */
export const RogueFlyingSwordCombatQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordPreviousPosition3View,
    FlyingSwordPosition3View,
    FlyingSwordDirection3View,
    FlyingSwordCombatType,
));

/** 单剑异步攻击开放接触窗口时的集成查询。 */
export const RogueFlyingSwordTaskContactQuery = QueryType.from(With(
    FlyingSwordView,
    FlyingSwordTaskView,
    FlyingSwordContactWindow,
    FlyingSwordPreviousPosition3View,
    FlyingSwordPosition3View,
    FlyingSwordDirection3View,
    FlyingSwordCombatType,
));
