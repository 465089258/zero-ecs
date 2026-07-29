import {
    All,
    QueryType,
    With,
    Without,
} from "@zero-ecs/game";
import {
    ControlledFlyingSwordTag,
    FlyingSwordActionView,
    FlyingSwordContactWindow,
    FlyingSwordDirection3View,
    FlyingSwordPosition3View,
    FlyingSwordPreviousPosition3View,
    FlyingSwordSkillActionView,
    FlyingSwordView,
    FlyingSwordTaskView,
} from "../../domain/flying-sword";
import {
    Direction3Type,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
} from "../../infrastructure/math";
import { MoveTowards3Type } from "../../infrastructure/motion";
import { CultivatorTag } from "../components";
import {
    AutoFlyingSwordSkillType,
    ChooseUpgradeRequestType,
    ColdSwordIntentType,
    DamageRequestType,
    DamageAttributionType,
    EnemyBodyType,
    EnemyCombatType,
    EnemyColdAccumulationType,
    EnemyDirectorType,
    EnemyEmpowermentType,
    EnemyFeedbackType,
    EnemyIdentityType,
    EnemyLocomotionType,
    ExperiencePickupType,
    ExperienceRewardType,
    FireBurstType,
    FireSwordIntentType,
    FlyingSwordCombatType,
    FlyingSwordContactCooldownType,
    FlyingSwordDamageSourceType,
    FlyingSwordPiercingSequenceType,
    FocusSwordHitHistoryType,
    FocusCastPowerType,
    HealthType,
    HealingRequestType,
    LevelExperienceType,
    LightningArcEnd3Type,
    LightningArcStart3Type,
    LightningArcType,
    LightningSwordIntentType,
    LifeRegenerationType,
    LifeLeechRuntimeType,
    LifeLeechStatsType,
    LifeOnKillRewardType,
    LifeOnKillType,
    LifePickupType,
    MetalSwordIntentType,
    PiercingDamageType,
    PlayerMovementType,
    PlayerPickupType,
    PlayerStaminaType,
    PlayerManaType,
    SpiritualSenseType,
    RogueRunClockType,
    RogueRunIdentityType,
    RogueRunRandomType,
    RogueRunStatisticsType,
    RogueRunStatusType,
    RogueRunTargetType,
    RvoAgentType,
    UpgradeSelectionType,
    SwordBodyUnityType,
    SwordBodyUnityPiercingSequenceType,
    SwordAttackType,
    SwordSpiritPowerType,
    SwordSpiritCostType,
    StoneGolemChargeType,
    SwordWraithEmpowermentType,
    PendingFocusCastType,
    PendingSwordReplacementType,
    ReplaceSwordRequestType,
    ResolvedHealingType,
    ResolvedDamageType,
    LeechEligibleDamageTag,
    ContainedSwordType,
    SwordIdentityType,
    SwordReplacementSelectionType,
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
    PlayerManaType,
    SpiritualSenseType,
));

export const RogueLifeRegenerationQuery = QueryType.from(With(
    HealthType,
    LifeRegenerationType,
));

export const RogueHealingRequestQuery = QueryType.from(With(
    HealingRequestType,
));

export const RogueResolvedHealingQuery = QueryType.from(With(
    HealingRequestType,
    ResolvedHealingType,
));

/** 敌人行为只读取玩家空间位置，不耦合玩家战斗与成长组件。 */
export const RogueCultivatorPositionQuery = QueryType.from(With(
    Position3Type,
    CultivatorTag,
));

/** 敌人行为只读取单局时钟与阶段。 */
export const RogueRunPhaseQuery = QueryType.from(With(
    RogueRunClockType,
    RogueRunStatusType,
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
    PlayerManaType,
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
    LifeOnKillRewardType,
));

/** 通用追逐行为只写速度、目标与行为期望值。 */
export const RogueEnemyIntentQuery = QueryType.from(With(
    Velocity3Type,
    MoveTowards3Type,
    EnemyLocomotionType,
));

export const RogueEnemyRenderQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    EnemyIdentityType,
    EnemyBodyType,
    HealthType,
    EnemyFeedbackType,
    EnemyColdAccumulationType,
    EnemyEmpowermentType,
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

export const RogueLifePickupQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
    LifePickupType,
));

export const RogueDamageRequestQuery = QueryType.from(All(
    With(DamageRequestType),
    Without(ResolvedDamageType),
));

export const RogueFlyingSwordDamageRequestQuery = QueryType.from(All(
    With(
        DamageRequestType,
        FlyingSwordDamageSourceType,
    ),
    Without(ResolvedDamageType),
));

export const RoguePiercingFlyingSwordDamageRequestQuery =
    QueryType.from(All(
        With(
            DamageRequestType,
            FlyingSwordDamageSourceType,
            PiercingDamageType,
        ),
        Without(ResolvedDamageType),
    ));

export const RogueResolvedDamageQuery = QueryType.from(With(
    DamageRequestType,
    ResolvedDamageType,
));

export const RogueLeechEligibleDamageQuery = QueryType.from(With(
    DamageRequestType,
    ResolvedDamageType,
    DamageAttributionType,
    LeechEligibleDamageTag,
));

export const RogueLifeLeechBeneficiaryQuery = QueryType.from(With(
    HealthType,
    LifeLeechStatsType,
    LifeLeechRuntimeType,
));

export const RogueLifeOnKillBeneficiaryQuery = QueryType.from(With(
    HealthType,
    LifeOnKillType,
    CultivatorTag,
));

export const RogueAutoFlyingSwordGroupQuery = QueryType.from(With(
    AutoFlyingSwordSkillType,
    LightningSwordIntentType,
    MetalSwordIntentType,
    FireSwordIntentType,
    ColdSwordIntentType,
));

export const RoguePendingFocusCastQuery = QueryType.from(With(
    PendingFocusCastType,
));

export const RoguePoweredFocusActionQuery = QueryType.from(With(
    FlyingSwordSkillActionView,
    FocusCastPowerType,
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
    EnemyLocomotionType,
    MoveTowards3Type,
    EnemyColdAccumulationType,
));

/** 最终运动输入归并只访问行为期望与 Motion。 */
export const RogueEnemyMovementQuery = QueryType.from(With(
    EnemyLocomotionType,
    MoveTowards3Type,
));

export const RogueRvoAgentQuery = QueryType.from(With(
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
    Direction3Type,
    MoveTowards3Type,
    EnemyBodyType,
    HealthType,
    RvoAgentType,
));

/** 基础接触伤害归并使用的最窄查询。 */
export const RogueEnemyCombatResolveQuery = QueryType.from(With(
    EnemyCombatType,
));

/** 强化脉冲只扫描存活、可强化敌人。 */
export const RogueEmpowerableEnemyQuery = QueryType.from(With(
    Position3Type,
    HealthType,
    EnemyEmpowermentType,
));

/** 剑魇精英能力查询，不在通用敌人循环中按 Kind 分派。 */
export const RogueSwordWraithEmpowermentQuery = QueryType.from(With(
    Position3Type,
    SwordWraithEmpowermentType,
));

/** 强化状态归并到最终移动与接触伤害。 */
export const RogueEnemyEmpowermentModifierQuery = QueryType.from(With(
    MoveTowards3Type,
    EnemyCombatType,
    EnemyEmpowermentType,
));

/** 镇山石傀专属行为查询，不按 EnemyKind 在通用敌人循环中分派。 */
export const RogueStoneGolemChargeQuery = QueryType.from(With(
    Position3Type,
    Velocity3Type,
    MoveTowards3Type,
    EnemyLocomotionType,
    StoneGolemChargeType,
));

/** 表现层只读取冲撞能力的空间与阶段事实。 */
export const RogueStoneGolemChargeRenderQuery = QueryType.from(With(
    Position3Type,
    StoneGolemChargeType,
));

/** 表现层只读取剑魇脉冲的空间与时序事实。 */
export const RogueSwordWraithEmpowermentRenderQuery = QueryType.from(With(
    Position3Type,
    SwordWraithEmpowermentType,
));

export const RogueChooseUpgradeRequestQuery = QueryType.from(With(
    ChooseUpgradeRequestType,
));

export const RogueSwordReplacementSelectionQuery = QueryType.from(With(
    SwordReplacementSelectionType,
));

export const RoguePendingSwordReplacementQuery = QueryType.from(With(
    PendingSwordReplacementType,
));

export const RogueReplaceSwordRequestQuery = QueryType.from(With(
    ReplaceSwordRequestType,
));

/** 满剑夹替换面板所需的只读单剑属性。 */
export const RogueSwordInventoryQuery = QueryType.from(With(
    FlyingSwordView,
    ContainedSwordType,
    SwordIdentityType,
    SwordAttackType,
    SwordSpiritPowerType,
    SwordSpiritCostType,
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
    SwordAttackType,
    ControlledFlyingSwordTag,
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
    SwordAttackType,
    SwordSpiritPowerType,
    SwordSpiritCostType,
    ControlledFlyingSwordTag,
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
    SwordAttackType,
    ControlledFlyingSwordTag,
));
