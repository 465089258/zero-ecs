import {
    Types,
    type Component,
    type ComponentTag,
} from "@zero-ecs/game";
import { Float3 } from "../../infrastructure/math";

/** 单局所拥有的核心实体。 */
export enum RogueRunIdentity {
    Player,
    SwordGroup,
    SwordContainer,
}

export class RogueRunIdentityType
implements Component<RogueRunIdentity> {
    readonly [RogueRunIdentity.Player] = Types.Entity;
    readonly [RogueRunIdentity.SwordGroup] = Types.Entity;
    readonly [RogueRunIdentity.SwordContainer] = Types.Entity;
}

export enum RogueRunClock {
    Tick,
}

export class RogueRunClockType implements Component<RogueRunClock> {
    readonly [RogueRunClock.Tick] = Types.U32;
}

export enum RogueRunPhase {
    Playing,
    Defeat,
    Victory,
}

export enum RogueRunStatus {
    Phase,
}

export class RogueRunStatusType implements Component<RogueRunStatus> {
    readonly [RogueRunStatus.Phase] = Types.U8;
}

export enum RogueRunRandom {
    Seed,
    State,
}

export class RogueRunRandomType implements Component<RogueRunRandom> {
    readonly [RogueRunRandom.Seed] = Types.U32;
    readonly [RogueRunRandom.State] = Types.U32;
}

export enum RogueRunStatistics {
    Kills,
    ActiveEnemies,
}

export class RogueRunStatisticsType
implements Component<RogueRunStatistics> {
    readonly [RogueRunStatistics.Kills] = Types.U32;
    readonly [RogueRunStatistics.ActiveEnemies] = Types.U32;
}

export enum EnemyDirector {
    Budget,
    InitialTarget,
    SpawnSerial,
}

export class EnemyDirectorType implements Component<EnemyDirector> {
    readonly [EnemyDirector.Budget] = Types.F32;
    readonly [EnemyDirector.InitialTarget] = Types.U16;
    readonly [EnemyDirector.SpawnSerial] = Types.U32;
}

/** 鼠标目标是单局输入事实，不再保存在全局 Scene State。 */
export enum RogueRunTarget {
    MoveX,
    MoveY,
    MoveZ,
    HasMove,
    SkillX,
    SkillY,
    SkillZ,
}

export class RogueRunTargetType implements Component<RogueRunTarget> {
    readonly [RogueRunTarget.MoveX] = Types.F32;
    readonly [RogueRunTarget.MoveY] = Types.F32;
    readonly [RogueRunTarget.MoveZ] = Types.F32;
    readonly [RogueRunTarget.HasMove] = Types.U8;
    readonly [RogueRunTarget.SkillX] = Types.F32;
    readonly [RogueRunTarget.SkillY] = Types.F32;
    readonly [RogueRunTarget.SkillZ] = Types.F32;
}

export enum Health {
    Current,
    Maximum,
}

export class HealthType implements Component<Health> {
    readonly [Health.Current] = Types.F32;
    readonly [Health.Maximum] = Types.F32;
}

export enum PlayerMovement {
    Speed,
}

export class PlayerMovementType implements Component<PlayerMovement> {
    readonly [PlayerMovement.Speed] = Types.F32;
}

export enum LevelExperience {
    Level,
    Current,
    Required,
    PendingChoices,
}

export class LevelExperienceType
implements Component<LevelExperience> {
    readonly [LevelExperience.Level] = Types.U16;
    readonly [LevelExperience.Current] = Types.F32;
    readonly [LevelExperience.Required] = Types.F32;
    readonly [LevelExperience.PendingChoices] = Types.U8;
}

export enum PlayerPickup {
    AttractionRadius,
    PickupRadius,
    AttractionSpeed,
}

export class PlayerPickupType implements Component<PlayerPickup> {
    readonly [PlayerPickup.AttractionRadius] = Types.F32;
    readonly [PlayerPickup.PickupRadius] = Types.F32;
    readonly [PlayerPickup.AttractionSpeed] = Types.F32;
}

/** 身剑合一消耗的玩家体力；非突进时持续恢复。 */
export enum PlayerStamina {
    Current,
    Maximum,
    DrainPerSecond,
    RecoveryPerSecond,
    RestartThreshold,
}

export class PlayerStaminaType implements Component<PlayerStamina> {
    readonly [PlayerStamina.Current] = Types.F32;
    readonly [PlayerStamina.Maximum] = Types.F32;
    readonly [PlayerStamina.DrainPerSecond] = Types.F32;
    readonly [PlayerStamina.RecoveryPerSecond] = Types.F32;
    readonly [PlayerStamina.RestartThreshold] = Types.F32;
}

/** 玩家能够同时维持的神识控制位。 */
export enum SpiritualSense {
    Base,
    Bonus,
}

export class SpiritualSenseType implements Component<SpiritualSense> {
    readonly [SpiritualSense.Base] = Types.U16;
    readonly [SpiritualSense.Bonus] = Types.U16;
}

/** 剑阵消耗的人物法力，非剑阵状态下持续恢复。 */
export enum PlayerMana {
    Current,
    Maximum,
    RecoveryPerSecond,
    FormationBaseDrainPerSecond,
    FormationDrainPerSwordPerSecond,
    FormationRestartThreshold,
}

export class PlayerManaType implements Component<PlayerMana> {
    readonly [PlayerMana.Current] = Types.F32;
    readonly [PlayerMana.Maximum] = Types.F32;
    readonly [PlayerMana.RecoveryPerSecond] = Types.F32;
    readonly [PlayerMana.FormationBaseDrainPerSecond] = Types.F32;
    readonly [PlayerMana.FormationDrainPerSwordPerSecond] = Types.F32;
    readonly [PlayerMana.FormationRestartThreshold] = Types.F32;
}

/** 当前装备的剑夹。 */
export enum SwordContainer {
    Owner,
    Capacity,
}

export class SwordContainerType implements Component<SwordContainer> {
    readonly [SwordContainer.Owner] = Types.Entity;
    readonly [SwordContainer.Capacity] = Types.U16;
}

/** 飞剑在剑夹中的稳定归属。 */
export enum ContainedSword {
    Container,
    InventorySlot,
}

export class ContainedSwordType implements Component<ContainedSword> {
    readonly [ContainedSword.Container] = Types.Entity;
    readonly [ContainedSword.InventorySlot] = Types.U16;
}

/** 单把剑的内容身份。 */
export enum SwordIdentity {
    Blueprint,
    Quality,
}

export class SwordIdentityType implements Component<SwordIdentity> {
    readonly [SwordIdentity.Blueprint] = Types.U16;
    readonly [SwordIdentity.Quality] = Types.U8;
}

/** 单把剑的独立攻击属性。 */
export enum SwordAttack {
    MinimumDamage,
    MaximumDamage,
    AttackIntervalTicks,
}

export class SwordAttackType implements Component<SwordAttack> {
    readonly [SwordAttack.MinimumDamage] = Types.F32;
    readonly [SwordAttack.MaximumDamage] = Types.F32;
    readonly [SwordAttack.AttackIntervalTicks] = Types.U16;
}

/** 单把剑的独立灵力池。 */
export enum SwordSpiritPower {
    Current,
    Maximum,
    RecoveryPerSecond,
    RecoveryStartTick,
}

export class SwordSpiritPowerType
implements Component<SwordSpiritPower> {
    readonly [SwordSpiritPower.Current] = Types.F32;
    readonly [SwordSpiritPower.Maximum] = Types.F32;
    readonly [SwordSpiritPower.RecoveryPerSecond] = Types.F32;
    readonly [SwordSpiritPower.RecoveryStartTick] = Types.U32;
}

/** 单把剑在不同战斗方式中的灵力消耗。 */
export enum SwordSpiritCost {
    Scatter,
    Focus,
    FormationPerSecond,
}

export class SwordSpiritCostType
implements Component<SwordSpiritCost> {
    readonly [SwordSpiritCost.Scatter] = Types.F32;
    readonly [SwordSpiritCost.Focus] = Types.F32;
    readonly [SwordSpiritCost.FormationPerSecond] = Types.F32;
}

/** 受控剑进入当前阵图后才具有的结构身份。 */
export class FormationFlyingSwordTag implements ComponentTag {}

/** 示例层控制组的飞剑战斗数值。 */
export enum AutoFlyingSwordSkill {
    TargetRadius,
    FocusDamageMultiplier,
    FormationDamageMultiplier,
    FormationContactCooldownTicks,
    ScatterLaunchCadenceTicks,
    ScatterLaunchSlotStride,
    FormationRadius,
    FormationAngularSpeed,
}

export class AutoFlyingSwordSkillType
implements Component<AutoFlyingSwordSkill> {
    readonly [AutoFlyingSwordSkill.TargetRadius] = Types.F32;
    readonly [AutoFlyingSwordSkill.FocusDamageMultiplier] = Types.F32;
    readonly [AutoFlyingSwordSkill.FormationDamageMultiplier] = Types.F32;
    readonly [AutoFlyingSwordSkill.FormationContactCooldownTicks] = Types.U16;
    readonly [AutoFlyingSwordSkill.ScatterLaunchCadenceTicks] = Types.U16;
    readonly [AutoFlyingSwordSkill.ScatterLaunchSlotStride] = Types.U16;
    readonly [AutoFlyingSwordSkill.FormationRadius] = Types.F32;
    readonly [AutoFlyingSwordSkill.FormationAngularSpeed] = Types.F32;
}

/** 示例构筑中的雷意规则参数，归属于飞剑控制组。 */
export enum LightningSwordIntent {
    ChainCount,
    ChainRadius,
    DamageMultiplier,
}

export class LightningSwordIntentType
implements Component<LightningSwordIntent> {
    readonly [LightningSwordIntent.ChainCount] = Types.U8;
    readonly [LightningSwordIntent.ChainRadius] = Types.F32;
    readonly [LightningSwordIntent.DamageMultiplier] = Types.F32;
}

/** 示例构筑中的金意规则参数，归属于飞剑控制组。 */
export enum MetalSwordIntent {
    MaximumMomentum,
    DamagePerMomentum,
}

export class MetalSwordIntentType
implements Component<MetalSwordIntent> {
    readonly [MetalSwordIntent.MaximumMomentum] = Types.U8;
    readonly [MetalSwordIntent.DamagePerMomentum] = Types.F32;
}

/** 示例构筑中的火意规则参数，归属于飞剑控制组。 */
export enum FireSwordIntent {
    BurstThreshold,
    BurstRadius,
    BurstDamageMultiplier,
}

export class FireSwordIntentType
implements Component<FireSwordIntent> {
    readonly [FireSwordIntent.BurstThreshold] = Types.U8;
    readonly [FireSwordIntent.BurstRadius] = Types.F32;
    readonly [FireSwordIntent.BurstDamageMultiplier] = Types.F32;
}

/** 示例构筑中的寒意规则参数，归属于飞剑控制组。 */
export enum ColdSwordIntent {
    MaximumStacks,
    SlowPerStack,
    DurationTicks,
}

export class ColdSwordIntentType
implements Component<ColdSwordIntent> {
    readonly [ColdSwordIntent.MaximumStacks] = Types.U8;
    readonly [ColdSwordIntent.SlowPerStack] = Types.F32;
    readonly [ColdSwordIntent.DurationTicks] = Types.U16;
}

export enum EnemyIdentity {
    Kind,
    Visual,
    Priority,
}

export class EnemyIdentityType implements Component<EnemyIdentity> {
    readonly [EnemyIdentity.Kind] = Types.U8;
    readonly [EnemyIdentity.Visual] = Types.U8;
    readonly [EnemyIdentity.Priority] = Types.U8;
}

export enum EnemyBody {
    Radius,
    CenterHeight,
}

export class EnemyBodyType implements Component<EnemyBody> {
    readonly [EnemyBody.Radius] = Types.F32;
    readonly [EnemyBody.CenterHeight] = Types.F32;
}

/**
 * 敌人的移动数值归并上下文。
 *
 * Base 字段由内容目录初始化；行为 System 写 Desired 字段；最终修正 System
 * 再把期望值与寒意等状态效果归并到 Motion 组件。
 */
export enum EnemyLocomotion {
    BaseSpeed,
    BaseAcceleration,
    DesiredSpeed,
    DesiredAcceleration,
}

export class EnemyLocomotionType
implements Component<EnemyLocomotion> {
    readonly [EnemyLocomotion.BaseSpeed] = Types.F32;
    readonly [EnemyLocomotion.BaseAcceleration] = Types.F32;
    readonly [EnemyLocomotion.DesiredSpeed] = Types.F32;
    readonly [EnemyLocomotion.DesiredAcceleration] = Types.F32;
}

export enum StoneGolemChargePhase {
    Pursuit,
    Windup,
    Charging,
    Recovery,
}

/** 仅镇山石傀拥有的冲撞能力事实。 */
export enum StoneGolemCharge {
    Phase,
    PhaseStartTick,
    NextChargeTick,
    DirectionX,
    DirectionZ,
}

export class StoneGolemChargeType
implements Component<StoneGolemCharge> {
    readonly [StoneGolemCharge.Phase] = Types.U8;
    readonly [StoneGolemCharge.PhaseStartTick] = Types.U32;
    readonly [StoneGolemCharge.NextChargeTick] = Types.U32;
    readonly [StoneGolemCharge.DirectionX] = Types.F32;
    readonly [StoneGolemCharge.DirectionZ] = Types.F32;
}

export enum EnemyCombat {
    BaseContactDamage,
    ContactDamage,
    NextContactTick,
}

export class EnemyCombatType implements Component<EnemyCombat> {
    readonly [EnemyCombat.BaseContactDamage] = Types.F32;
    readonly [EnemyCombat.ContactDamage] = Types.F32;
    readonly [EnemyCombat.NextContactTick] = Types.U32;
}

/** 所有敌人都可持有的剑魇强化状态；重复脉冲只刷新而不叠乘。 */
export enum EnemyEmpowerment {
    Source,
    ExpireTick,
    SpeedMultiplier,
    ContactDamageMultiplier,
}

export class EnemyEmpowermentType
implements Component<EnemyEmpowerment> {
    readonly [EnemyEmpowerment.Source] = Types.Entity;
    readonly [EnemyEmpowerment.ExpireTick] = Types.U32;
    readonly [EnemyEmpowerment.SpeedMultiplier] = Types.F32;
    readonly [EnemyEmpowerment.ContactDamageMultiplier] = Types.F32;
}

/** 仅剑魇精英拥有的周期范围强化能力。 */
export enum SwordWraithEmpowerment {
    Radius,
    IntervalTicks,
    DurationTicks,
    NextPulseTick,
    SpeedMultiplier,
    ContactDamageMultiplier,
    PulseEndTick,
}

export class SwordWraithEmpowermentType
implements Component<SwordWraithEmpowerment> {
    readonly [SwordWraithEmpowerment.Radius] = Types.F32;
    readonly [SwordWraithEmpowerment.IntervalTicks] = Types.U16;
    readonly [SwordWraithEmpowerment.DurationTicks] = Types.U16;
    readonly [SwordWraithEmpowerment.NextPulseTick] = Types.U32;
    readonly [SwordWraithEmpowerment.SpeedMultiplier] = Types.F32;
    readonly [SwordWraithEmpowerment.ContactDamageMultiplier] = Types.F32;
    readonly [SwordWraithEmpowerment.PulseEndTick] = Types.U32;
}

export enum ExperienceReward {
    Value,
}

export class ExperienceRewardType
implements Component<ExperienceReward> {
    readonly [ExperienceReward.Value] = Types.F32;
}

/** 示例层为每把飞剑维护的分散攻击目标与再攻击时间。 */
export enum FlyingSwordCombat {
    Target,
    NextAttackTick,
    AttackSequence,
    RolledDamage,
}

export class FlyingSwordCombatType
implements Component<FlyingSwordCombat> {
    readonly [FlyingSwordCombat.Target] = Types.Entity;
    readonly [FlyingSwordCombat.NextAttackTick] = Types.U32;
    readonly [FlyingSwordCombat.AttackSequence] = Types.U32;
    readonly [FlyingSwordCombat.RolledDamage] = Types.F32;
}

/** 单剑在一次集火动作中的贯穿进度。 */
export enum FlyingSwordPiercingSequence {
    Action,
    HitCount,
}

export class FlyingSwordPiercingSequenceType
implements Component<FlyingSwordPiercingSequence> {
    readonly [FlyingSwordPiercingSequence.Action] = Types.Entity;
    readonly [FlyingSwordPiercingSequence.HitCount] = Types.U16;
}

/** 敌人对持续型剑阵与身剑合一的短冷却。 */
export enum FlyingSwordContactCooldown {
    FormationNextTick,
    FusionNextTick,
}

export class FlyingSwordContactCooldownType
implements Component<FlyingSwordContactCooldown> {
    readonly [FlyingSwordContactCooldown.FormationNextTick] = Types.U32;
    readonly [FlyingSwordContactCooldown.FusionNextTick] = Types.U32;
}

/** 敌人在同次集火中已经被哪些剑槽贯穿。 */
export enum FocusSwordHitHistory {
    Action,
    SwordMaskLow,
    SwordMaskHigh,
}

export class FocusSwordHitHistoryType
implements Component<FocusSwordHitHistory> {
    readonly [FocusSwordHitHistory.Action] = Types.Entity;
    readonly [FocusSwordHitHistory.SwordMaskLow] = Types.U32;
    readonly [FocusSwordHitHistory.SwordMaskHigh] = Types.U32;
}

/** 敌人供表现层读取的战斗反馈事实。 */
export enum EnemyFeedback {
    TargetedSwordCount,
    HitFlashEndTick,
    HitKind,
}

export class EnemyFeedbackType
implements Component<EnemyFeedback> {
    readonly [EnemyFeedback.TargetedSwordCount] = Types.U16;
    readonly [EnemyFeedback.HitFlashEndTick] = Types.U32;
    readonly [EnemyFeedback.HitKind] = Types.U8;
}

/** 单控制组示例中的敌人火印积累。 */
export enum EnemyFireAccumulation {
    SourceGroup,
    Stacks,
}

export class EnemyFireAccumulationType
implements Component<EnemyFireAccumulation> {
    readonly [EnemyFireAccumulation.SourceGroup] = Types.Entity;
    readonly [EnemyFireAccumulation.Stacks] = Types.U8;
}

/** 敌人当前由单控制组施加的寒气层数与到期时间。 */
export enum EnemyColdAccumulation {
    SourceGroup,
    Stacks,
    ExpireTick,
}

export class EnemyColdAccumulationType
implements Component<EnemyColdAccumulation> {
    readonly [EnemyColdAccumulation.SourceGroup] = Types.Entity;
    readonly [EnemyColdAccumulation.Stacks] = Types.U8;
    readonly [EnemyColdAccumulation.ExpireTick] = Types.U32;
}

/** 玩家身剑合一动作；常驻组件避免动作开始时迁移玩家 Archetype。 */
export enum SwordBodyUnity {
    Active,
    StartTick,
    DirectionX,
    DirectionZ,
    Damage,
    Group,
    Phase,
}

export enum SwordBodyUnityPhase {
    Idle,
    Gathering,
    Dashing,
}

export class SwordBodyUnityType
implements Component<SwordBodyUnity> {
    readonly [SwordBodyUnity.Active] = Types.U8;
    readonly [SwordBodyUnity.StartTick] = Types.U32;
    readonly [SwordBodyUnity.DirectionX] = Types.F32;
    readonly [SwordBodyUnity.DirectionZ] = Types.F32;
    readonly [SwordBodyUnity.Damage] = Types.F32;
    readonly [SwordBodyUnity.Group] = Types.Entity;
    readonly [SwordBodyUnity.Phase] = Types.U8;
}

/** 输入确认后、领域技能 Action 生成前保存的集火法力快照。 */
export enum PendingFocusCast {
    Group,
    ManaSpent,
    DamageMultiplier,
}

export class PendingFocusCastType
implements Component<PendingFocusCast> {
    readonly [PendingFocusCast.Group] = Types.Entity;
    readonly [PendingFocusCast.ManaSpent] = Types.F32;
    readonly [PendingFocusCast.DamageMultiplier] = Types.F32;
}

/** 附着于本次集火 Action 的法力爆发参数。 */
export enum FocusCastPower {
    ManaSpent,
    DamageMultiplier,
}

export class FocusCastPowerType
implements Component<FocusCastPower> {
    readonly [FocusCastPower.ManaSpent] = Types.F32;
    readonly [FocusCastPower.DamageMultiplier] = Types.F32;
}

/** 身剑合一核心扫掠在一次持续突进中的贯穿进度。 */
export enum SwordBodyUnityPiercingSequence {
    StartTick,
    HitCount,
}

export class SwordBodyUnityPiercingSequenceType
implements Component<SwordBodyUnityPiercingSequence> {
    readonly [SwordBodyUnityPiercingSequence.StartTick] = Types.U32;
    readonly [SwordBodyUnityPiercingSequence.HitCount] = Types.U16;
}

export enum DamageRequest {
    Source,
    Target,
    Amount,
    Kind,
}

/** 示例战斗 Integration 对一次伤害来源的语义分类。 */
export enum DamageKind {
    Generic,
    ScatterSword,
    FocusSword,
    FormationSword,
    SwordBodyUnity,
    LightningChain,
    MetalBreak,
    FireBurst,
}

export class DamageRequestType implements Component<DamageRequest> {
    readonly [DamageRequest.Source] = Types.Entity;
    readonly [DamageRequest.Target] = Types.Entity;
    readonly [DamageRequest.Amount] = Types.F32;
    readonly [DamageRequest.Kind] = Types.U8;
}

/** 飞剑伤害事实携带的控制组上下文，供宿主剑意规则解释。 */
export enum FlyingSwordDamageSource {
    Group,
}

export class FlyingSwordDamageSourceType
implements Component<FlyingSwordDamageSource> {
    readonly [FlyingSwordDamageSource.Group] = Types.Entity;
}

/** 贯穿伤害事实携带的前置命中数，供金意规则解释。 */
export enum PiercingDamage {
    PriorHits,
}

export class PiercingDamageType
implements Component<PiercingDamage> {
    readonly [PiercingDamage.PriorHits] = Types.U16;
}

export enum LightningArc {
    StartTick,
    DurationTicks,
}

/** 雷意连锁产生的短生命周期表现事实。 */
export class LightningArcType implements Component<LightningArc> {
    readonly [LightningArc.StartTick] = Types.U32;
    readonly [LightningArc.DurationTicks] = Types.U16;
}

export class LightningArcStart3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export class LightningArcEnd3Type implements Component<Float3> {
    readonly [Float3.X] = Types.F32;
    readonly [Float3.Y] = Types.F32;
    readonly [Float3.Z] = Types.F32;
}

export enum FireBurst {
    StartTick,
    DurationTicks,
    Radius,
}

/** 火意达到阈值后产生的短生命周期表现事实。 */
export class FireBurstType implements Component<FireBurst> {
    readonly [FireBurst.StartTick] = Types.U32;
    readonly [FireBurst.DurationTicks] = Types.U16;
    readonly [FireBurst.Radius] = Types.F32;
}

export enum ExperiencePickup {
    Value,
}

export class ExperiencePickupType
implements Component<ExperiencePickup> {
    readonly [ExperiencePickup.Value] = Types.F32;
}

export enum UpgradeSelection {
    Active,
    OptionA,
    OptionB,
    OptionC,
    SwordOffer,
}

export class UpgradeSelectionType
implements Component<UpgradeSelection> {
    readonly [UpgradeSelection.Active] = Types.U8;
    readonly [UpgradeSelection.OptionA] = Types.U8;
    readonly [UpgradeSelection.OptionB] = Types.U8;
    readonly [UpgradeSelection.OptionC] = Types.U8;
    readonly [UpgradeSelection.SwordOffer] = Types.Entity;
}

/** 当前升级选择中“添置飞剑”对应的具体剑胚。 */
export enum SwordUpgradeOffer {
    Blueprint,
    Quality,
    Recommendation,
    MinimumDamage,
    MaximumDamage,
    AttackIntervalTicks,
    MaximumSpeed,
    Acceleration,
    MaximumSpiritPower,
    SpiritRecoveryPerSecond,
    ScatterSpiritCost,
    FocusSpiritCost,
    FormationSpiritDrainPerSecond,
}

export class SwordUpgradeOfferType
implements Component<SwordUpgradeOffer> {
    readonly [SwordUpgradeOffer.Blueprint] = Types.U16;
    readonly [SwordUpgradeOffer.Quality] = Types.U8;
    readonly [SwordUpgradeOffer.Recommendation] = Types.U8;
    readonly [SwordUpgradeOffer.MinimumDamage] = Types.F32;
    readonly [SwordUpgradeOffer.MaximumDamage] = Types.F32;
    readonly [SwordUpgradeOffer.AttackIntervalTicks] = Types.U16;
    readonly [SwordUpgradeOffer.MaximumSpeed] = Types.F32;
    readonly [SwordUpgradeOffer.Acceleration] = Types.F32;
    readonly [SwordUpgradeOffer.MaximumSpiritPower] = Types.F32;
    readonly [SwordUpgradeOffer.SpiritRecoveryPerSecond] = Types.F32;
    readonly [SwordUpgradeOffer.ScatterSpiritCost] = Types.F32;
    readonly [SwordUpgradeOffer.FocusSpiritCost] = Types.F32;
    readonly [SwordUpgradeOffer.FormationSpiritDrainPerSecond] = Types.F32;
}

export enum ChooseUpgradeRequest {
    Slot,
}

export class ChooseUpgradeRequestType
implements Component<ChooseUpgradeRequest> {
    readonly [ChooseUpgradeRequest.Slot] = Types.U8;
}
