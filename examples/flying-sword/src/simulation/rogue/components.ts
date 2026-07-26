import {
    Types,
    type Component,
} from "@zero-ecs/game";
import { Float3 } from "@zero-ecs/math/3d";

/** 单局所拥有的核心实体。 */
export enum RogueRunIdentity {
    Player,
    SwordGroup,
}

export class RogueRunIdentityType
implements Component<RogueRunIdentity> {
    readonly [RogueRunIdentity.Player] = Types.Entity;
    readonly [RogueRunIdentity.SwordGroup] = Types.Entity;
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

/** 示例层控制组的飞剑战斗数值。 */
export enum AutoFlyingSwordSkill {
    ReattackDelayTicks,
    TargetRadius,
    Damage,
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
    readonly [AutoFlyingSwordSkill.ReattackDelayTicks] = Types.U16;
    readonly [AutoFlyingSwordSkill.TargetRadius] = Types.F32;
    readonly [AutoFlyingSwordSkill.Damage] = Types.F32;
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
    ContactDamage,
    NextContactTick,
}

export class EnemyCombatType implements Component<EnemyCombat> {
    readonly [EnemyCombat.ContactDamage] = Types.F32;
    readonly [EnemyCombat.NextContactTick] = Types.U32;
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
}

export class FlyingSwordCombatType
implements Component<FlyingSwordCombat> {
    readonly [FlyingSwordCombat.Target] = Types.Entity;
    readonly [FlyingSwordCombat.NextAttackTick] = Types.U32;
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
}

export class SwordBodyUnityType
implements Component<SwordBodyUnity> {
    readonly [SwordBodyUnity.Active] = Types.U8;
    readonly [SwordBodyUnity.StartTick] = Types.U32;
    readonly [SwordBodyUnity.DirectionX] = Types.F32;
    readonly [SwordBodyUnity.DirectionZ] = Types.F32;
    readonly [SwordBodyUnity.Damage] = Types.F32;
    readonly [SwordBodyUnity.Group] = Types.Entity;
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
}

export class UpgradeSelectionType
implements Component<UpgradeSelection> {
    readonly [UpgradeSelection.Active] = Types.U8;
    readonly [UpgradeSelection.OptionA] = Types.U8;
    readonly [UpgradeSelection.OptionB] = Types.U8;
    readonly [UpgradeSelection.OptionC] = Types.U8;
}

export enum ChooseUpgradeRequest {
    Slot,
}

export class ChooseUpgradeRequestType
implements Component<ChooseUpgradeRequest> {
    readonly [ChooseUpgradeRequest.Slot] = Types.U8;
}
