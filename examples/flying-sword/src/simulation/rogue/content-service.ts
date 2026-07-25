import {
    Commands,
    Inject,
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
    DamageRequest,
    DamageRequestType,
    EnemyBody,
    EnemyBodyType,
    EnemyCombat,
    EnemyCombatType,
    EnemyIdentity,
    EnemyIdentityType,
    ExperiencePickup,
    ExperiencePickupType,
    ExperienceReward,
    ExperienceRewardType,
    FlyingSwordContactCooldown,
    FlyingSwordContactCooldownType,
    Health,
    HealthType,
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
            .add(HealthType)
            .add(ExperienceRewardType)
            .add(FlyingSwordContactCooldownType)
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
    ): Entity {
        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(DamageRequestType)
            .set(DamageRequestType, DamageRequest.Source, source)
            .set(DamageRequestType, DamageRequest.Target, target)
            .set(DamageRequestType, DamageRequest.Amount, amount)
            .submit();
        return entity;
    }
}
