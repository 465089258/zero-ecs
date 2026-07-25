import {
    Types,
    type Component,
} from "@zero-ecs/game";

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

export enum AutoFlyingSwordSkill {
    CooldownTicks,
    NextCastTick,
    TargetRadius,
    Damage,
}

export class AutoFlyingSwordSkillType
implements Component<AutoFlyingSwordSkill> {
    readonly [AutoFlyingSwordSkill.CooldownTicks] = Types.U16;
    readonly [AutoFlyingSwordSkill.NextCastTick] = Types.U32;
    readonly [AutoFlyingSwordSkill.TargetRadius] = Types.F32;
    readonly [AutoFlyingSwordSkill.Damage] = Types.F32;
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
    MoveSpeed,
}

export class EnemyBodyType implements Component<EnemyBody> {
    readonly [EnemyBody.Radius] = Types.F32;
    readonly [EnemyBody.CenterHeight] = Types.F32;
    readonly [EnemyBody.MoveSpeed] = Types.F32;
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

/** 同一技能动作对同一敌人只结算一次。 */
export enum FlyingSwordHitMemory {
    Action,
    ActionStartTick,
}

export class FlyingSwordHitMemoryType
implements Component<FlyingSwordHitMemory> {
    readonly [FlyingSwordHitMemory.Action] = Types.Entity;
    readonly [FlyingSwordHitMemory.ActionStartTick] = Types.U32;
}

export enum DamageRequest {
    Source,
    Target,
    Amount,
}

export class DamageRequestType implements Component<DamageRequest> {
    readonly [DamageRequest.Source] = Types.Entity;
    readonly [DamageRequest.Target] = Types.Entity;
    readonly [DamageRequest.Amount] = Types.F32;
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
