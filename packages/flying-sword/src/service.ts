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
    FlyingSwordFlight,
    FlyingSwordGroupField,
    FlyingSwordMember,
    FlyingSwordMode,
    type CreateFlyingSwordGroupOptions,
    type CreateFlyingSwordOptions,
    type ReadonlyVector3,
} from "./types";
import { FlyingSwordRequestState } from "./runtime/request-state";
import {
    FlyingSwordFlightStorage,
    FlyingSwordFormationGoal3Storage,
    FlyingSwordGroupStorage,
    FlyingSwordMemberStorage,
} from "./runtime/storage";

/**
 * 飞剑领域的窄操作入口。
 *
 * 创建操作提交 Commands；战术指令写入请求队列并在下一固定 Tick 生效。
 */
export class FlyingSwordService extends Service {
    @Inject.service(Commands) private readonly commands!: Commands;
    @Inject.state(FlyingSwordRequestState) private readonly requests!: FlyingSwordRequestState;

    createGroup(options: CreateFlyingSwordGroupOptions): Entity {
        const center = options.center ?? ZERO_VECTOR;
        const formationSize = integerInRange(
            "formationSize",
            options.formationSize ?? 7,
            1,
            0xffff,
        );
        const orbitRadius = positive("orbitRadius", options.orbitRadius ?? 2.8);
        const orbitHeight = finite("orbitHeight", options.orbitHeight ?? 2.2);
        const angularSpeed = finite("angularSpeed", options.angularSpeed ?? 0.9);
        const verticalAmplitude = nonNegative(
            "verticalAmplitude",
            options.verticalAmplitude ?? 0.75,
        );
        const verticalSpeed = positive("verticalSpeed", options.verticalSpeed ?? 1.45);
        vector("center", center);

        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(FlyingSwordGroupStorage)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.Owner, options.owner)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.CenterX, center.x)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.CenterY, center.y)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.CenterZ, center.z)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.TargetX, center.x)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.TargetY, center.y)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.TargetZ, center.z)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.OrbitRadius, orbitRadius)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.OrbitHeight, orbitHeight)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.AngularSpeed, angularSpeed)
            .set(
                FlyingSwordGroupStorage,
                FlyingSwordGroupField.VerticalAmplitude,
                verticalAmplitude,
            )
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.VerticalSpeed, verticalSpeed)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.FormationSize, formationSize)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.Mode, FlyingSwordMode.Orbit)
            .set(FlyingSwordGroupStorage, FlyingSwordGroupField.Revision, 1)
            .submit();
        return entity;
    }

    createSword(options: CreateFlyingSwordOptions): Entity {
        vector("position", options.position);
        const slot = integerInRange("slot", options.slot ?? 0, 0, 0xffff);
        const maximumSpeed = positive("maximumSpeed", options.maximumSpeed ?? 12);
        const acceleration = positive("acceleration", options.acceleration ?? 36);
        const { x, y, z } = options.position;

        const command = this.commands.spawn();
        const entity = command.entity;
        command
            .add(FlyingSwordMemberStorage)
            .add(FlyingSwordFlightStorage)
            .add(Position3Type)
            .add(PreviousPosition3Type)
            .add(Velocity3Type)
            .add(Direction3Type)
            .add(FlyingSwordFormationGoal3Storage)
            .add(MoveTowards3Type)
            .set(
                FlyingSwordMemberStorage,
                FlyingSwordMember.Group,
                options.group,
            )
            .set(FlyingSwordMemberStorage, FlyingSwordMember.Slot, slot)
            .set(
                FlyingSwordFlightStorage,
                FlyingSwordFlight.MaximumSpeed,
                maximumSpeed,
            )
            .set(
                FlyingSwordFlightStorage,
                FlyingSwordFlight.Acceleration,
                acceleration,
            )
            .set(Position3Type, Float3.X, x)
            .set(Position3Type, Float3.Y, y)
            .set(Position3Type, Float3.Z, z)
            .set(PreviousPosition3Type, Float3.X, x)
            .set(PreviousPosition3Type, Float3.Y, y)
            .set(PreviousPosition3Type, Float3.Z, z)
            .set(Velocity3Type, Float3.X, 0)
            .set(Velocity3Type, Float3.Y, 0)
            .set(Velocity3Type, Float3.Z, 0)
            .set(Direction3Type, Float3.X, 0)
            .set(Direction3Type, Float3.Y, 0)
            .set(Direction3Type, Float3.Z, 1)
            .set(FlyingSwordFormationGoal3Storage, Float3.X, x)
            .set(FlyingSwordFormationGoal3Storage, Float3.Y, y)
            .set(FlyingSwordFormationGoal3Storage, Float3.Z, z)
            .set(MoveTowards3Type, MoveTowards3.TargetX, x)
            .set(MoveTowards3Type, MoveTowards3.TargetY, y)
            .set(MoveTowards3Type, MoveTowards3.TargetZ, z)
            .set(
                MoveTowards3Type,
                MoveTowards3.MaximumSpeed,
                maximumSpeed,
            )
            .set(
                MoveTowards3Type,
                MoveTowards3.Acceleration,
                acceleration,
            )
            .set(
                MoveTowards3Type,
                MoveTowards3.ArrivalRadius,
                DEFAULT_ARRIVAL_RADIUS,
            )
            .submit();
        return entity;
    }

    orbit(group: Entity): void {
        this.requests.setMode(group, FlyingSwordMode.Orbit);
    }

    recall(group: Entity): void {
        this.requests.setMode(group, FlyingSwordMode.Recall);
    }

    focus(group: Entity, target: ReadonlyVector3): void {
        vector("target", target);
        this.requests.setTargetPoint(group, target.x, target.y, target.z);
        this.requests.setMode(group, FlyingSwordMode.Focus);
    }

    setCenter(group: Entity, center: ReadonlyVector3): void {
        vector("center", center);
        this.requests.setCenter(group, center.x, center.y, center.z);
    }
}

const ZERO_VECTOR: ReadonlyVector3 = Object.freeze({ x: 0, y: 0, z: 0 });
const DEFAULT_ARRIVAL_RADIUS = 0.15;

function finite(name: string, value: number): number {
    if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
    return value;
}

function positive(name: string, value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${name} must be a finite positive number`);
    }
    return value;
}

function nonNegative(name: string, value: number): number {
    if (!Number.isFinite(value) || value < 0) {
        throw new RangeError(`${name} must be a finite non-negative number`);
    }
    return value;
}

function integerInRange(name: string, value: number, minimum: number, maximum: number): number {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
        throw new RangeError(`${name} must be an integer in [${minimum}, ${maximum}]`);
    }
    return value;
}

function vector(name: string, value: ReadonlyVector3): void {
    finite(`${name}.x`, value.x);
    finite(`${name}.y`, value.y);
    finite(`${name}.z`, value.z);
}
