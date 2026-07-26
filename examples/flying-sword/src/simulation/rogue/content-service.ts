import {
    Commands,
    Inject,
    INVALID_ENTITY,
    Service,
    type Entity,
} from "@zero-ecs/game";
import {
    Direction3Type,
    Float3,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
} from "@zero-ecs/math/3d";
import {
    MoveTowards3,
    MoveTowards3Type,
} from "@zero-ecs/motion/3d";
import {
    EnemyCatalog,
    type EnemyKind,
} from "../../content/enemies";
import {
    DamageKind,
    DamageRequest,
    DamageRequestType,
    EnemyBody,
    EnemyBodyType,
    EnemyCombat,
    EnemyCombatType,
    EnemyFeedback,
    EnemyFeedbackType,
    EnemyFireAccumulation,
    EnemyFireAccumulationType,
    EnemyIdentity,
    EnemyIdentityType,
    ExperiencePickup,
    ExperiencePickupType,
    ExperienceReward,
    ExperienceRewardType,
    FocusSwordHitHistory,
    FocusSwordHitHistoryType,
    FireBurst,
    FireBurstType,
    FlyingSwordContactCooldown,
    FlyingSwordContactCooldownType,
    FlyingSwordDamageSource,
    FlyingSwordDamageSourceType,
    Health,
    HealthType,
    LightningArc,
    LightningArcEnd3Type,
    LightningArcStart3Type,
    LightningArcType,
    PiercingDamage,
    PiercingDamageType,
} from "./components";

/** 示例组合根：集中组装“敌人具有生命、移动、伤害与经验”等跨模块规则。 */
export class RogueContentService extends Service {
    @Inject.service(Commands) private readonly commands!: Commands;
    @Inject.resource(EnemyCatalog)
    private readonly enemies!: EnemyCatalog;

    spawnEnemy(
        kind: EnemyKind,
        x: number,
        z: number,
        targetX: number,
        targetZ: number,
        healthScale: number,
    ): Entity {
        const catalog = this.enemies;
        const health = catalog.health[kind] * healthScale;
        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(Position3Type)
            .add(PreviousPosition3Type)
            .add(Velocity3Type)
            .add(Direction3Type)
            .add(MoveTowards3Type)
            .add(EnemyIdentityType)
            .add(EnemyBodyType)
            .add(EnemyCombatType)
            .add(EnemyFeedbackType)
            .add(HealthType)
            .add(ExperienceRewardType)
            .add(FlyingSwordContactCooldownType)
            .add(FocusSwordHitHistoryType)
            .add(EnemyFireAccumulationType)
            .set(Position3Type, Float3.X, x)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, z)
            .set(PreviousPosition3Type, Float3.X, x)
            .set(PreviousPosition3Type, Float3.Y, 0)
            .set(PreviousPosition3Type, Float3.Z, z)
            .set(Velocity3Type, Float3.X, 0)
            .set(Velocity3Type, Float3.Y, 0)
            .set(Velocity3Type, Float3.Z, 0)
            .set(Direction3Type, Float3.X, 0)
            .set(Direction3Type, Float3.Y, 0)
            .set(Direction3Type, Float3.Z, 1)
            .set(MoveTowards3Type, MoveTowards3.TargetX, targetX)
            .set(MoveTowards3Type, MoveTowards3.TargetY, 0)
            .set(MoveTowards3Type, MoveTowards3.TargetZ, targetZ)
            .set(
                MoveTowards3Type,
                MoveTowards3.MaximumSpeed,
                catalog.speed[kind],
            )
            .set(
                MoveTowards3Type,
                MoveTowards3.Acceleration,
                catalog.acceleration[kind],
            )
            .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0)
            .set(EnemyIdentityType, EnemyIdentity.Kind, kind)
            .set(EnemyIdentityType, EnemyIdentity.Visual, kind)
            .set(
                EnemyIdentityType,
                EnemyIdentity.Priority,
                catalog.priority[kind],
            )
            .set(EnemyBodyType, EnemyBody.Radius, catalog.radius[kind])
            .set(
                EnemyBodyType,
                EnemyBody.CenterHeight,
                catalog.centerHeight[kind],
            )
            .set(
                EnemyBodyType,
                EnemyBody.MoveSpeed,
                catalog.speed[kind],
            )
            .set(
                EnemyCombatType,
                EnemyCombat.ContactDamage,
                catalog.contactDamage[kind],
            )
            .set(EnemyCombatType, EnemyCombat.NextContactTick, 0)
            .set(
                EnemyFeedbackType,
                EnemyFeedback.TargetedSwordCount,
                0,
            )
            .set(EnemyFeedbackType, EnemyFeedback.HitFlashEndTick, 0)
            .set(
                EnemyFeedbackType,
                EnemyFeedback.HitKind,
                DamageKind.Generic,
            )
            .set(HealthType, Health.Current, health)
            .set(HealthType, Health.Maximum, health)
            .set(
                ExperienceRewardType,
                ExperienceReward.Value,
                catalog.experience[kind],
            )
            .set(
                FlyingSwordContactCooldownType,
                FlyingSwordContactCooldown.FormationNextTick,
                0,
            )
            .set(
                FlyingSwordContactCooldownType,
                FlyingSwordContactCooldown.FusionNextTick,
                0,
            )
            .set(
                FocusSwordHitHistoryType,
                FocusSwordHitHistory.Action,
                INVALID_ENTITY,
            )
            .set(
                FocusSwordHitHistoryType,
                FocusSwordHitHistory.SwordMaskLow,
                0,
            )
            .set(
                FocusSwordHitHistoryType,
                FocusSwordHitHistory.SwordMaskHigh,
                0,
            )
            .set(
                EnemyFireAccumulationType,
                EnemyFireAccumulation.SourceGroup,
                INVALID_ENTITY,
            )
            .set(
                EnemyFireAccumulationType,
                EnemyFireAccumulation.Stacks,
                0,
            )
            .submit();
        return entity;
    }

    spawnExperience(x: number, z: number, value: number): Entity {
        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(Position3Type)
            .add(PreviousPosition3Type)
            .add(Velocity3Type)
            .add(ExperiencePickupType)
            .set(Position3Type, Float3.X, x)
            .set(Position3Type, Float3.Y, 0.24)
            .set(Position3Type, Float3.Z, z)
            .set(PreviousPosition3Type, Float3.X, x)
            .set(PreviousPosition3Type, Float3.Y, 0.24)
            .set(PreviousPosition3Type, Float3.Z, z)
            .set(Velocity3Type, Float3.X, 0)
            .set(Velocity3Type, Float3.Y, 0)
            .set(Velocity3Type, Float3.Z, 0)
            .set(ExperiencePickupType, ExperiencePickup.Value, value)
            .submit();
        return entity;
    }

    requestDamage(
        source: Entity,
        target: Entity,
        amount: number,
        kind: DamageKind = DamageKind.Generic,
    ): Entity {
        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(DamageRequestType)
            .set(DamageRequestType, DamageRequest.Source, source)
            .set(DamageRequestType, DamageRequest.Target, target)
            .set(DamageRequestType, DamageRequest.Amount, amount)
            .set(DamageRequestType, DamageRequest.Kind, kind)
            .submit();
        return entity;
    }

    requestFlyingSwordDamage(
        source: Entity,
        sourceGroup: Entity,
        target: Entity,
        amount: number,
        kind: DamageKind,
    ): Entity {
        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(DamageRequestType)
            .add(FlyingSwordDamageSourceType)
            .set(DamageRequestType, DamageRequest.Source, source)
            .set(DamageRequestType, DamageRequest.Target, target)
            .set(DamageRequestType, DamageRequest.Amount, amount)
            .set(DamageRequestType, DamageRequest.Kind, kind)
            .set(
                FlyingSwordDamageSourceType,
                FlyingSwordDamageSource.Group,
                sourceGroup,
            )
            .submit();
        return entity;
    }

    requestPiercingFlyingSwordDamage(
        source: Entity,
        sourceGroup: Entity,
        target: Entity,
        amount: number,
        kind: DamageKind,
        priorHits: number,
    ): Entity {
        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(DamageRequestType)
            .add(FlyingSwordDamageSourceType)
            .add(PiercingDamageType)
            .set(DamageRequestType, DamageRequest.Source, source)
            .set(DamageRequestType, DamageRequest.Target, target)
            .set(DamageRequestType, DamageRequest.Amount, amount)
            .set(DamageRequestType, DamageRequest.Kind, kind)
            .set(
                FlyingSwordDamageSourceType,
                FlyingSwordDamageSource.Group,
                sourceGroup,
            )
            .set(
                PiercingDamageType,
                PiercingDamage.PriorHits,
                priorHits,
            )
            .submit();
        return entity;
    }

    spawnLightningArc(
        startX: number,
        startY: number,
        startZ: number,
        endX: number,
        endY: number,
        endZ: number,
        startTick: number,
        durationTicks: number,
    ): Entity {
        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(LightningArcType)
            .add(LightningArcStart3Type)
            .add(LightningArcEnd3Type)
            .set(LightningArcType, LightningArc.StartTick, startTick)
            .set(
                LightningArcType,
                LightningArc.DurationTicks,
                durationTicks,
            )
            .set(LightningArcStart3Type, Float3.X, startX)
            .set(LightningArcStart3Type, Float3.Y, startY)
            .set(LightningArcStart3Type, Float3.Z, startZ)
            .set(LightningArcEnd3Type, Float3.X, endX)
            .set(LightningArcEnd3Type, Float3.Y, endY)
            .set(LightningArcEnd3Type, Float3.Z, endZ)
            .submit();
        return entity;
    }

    spawnFireBurst(
        x: number,
        y: number,
        z: number,
        radius: number,
        startTick: number,
        durationTicks: number,
    ): Entity {
        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(Position3Type)
            .add(FireBurstType)
            .set(Position3Type, Float3.X, x)
            .set(Position3Type, Float3.Y, y)
            .set(Position3Type, Float3.Z, z)
            .set(FireBurstType, FireBurst.StartTick, startTick)
            .set(
                FireBurstType,
                FireBurst.DurationTicks,
                durationTicks,
            )
            .set(FireBurstType, FireBurst.Radius, radius)
            .submit();
        return entity;
    }
}
