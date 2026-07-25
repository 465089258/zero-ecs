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
    FlyingSwordControl,
    FlyingSwordFormation,
    FlyingSwordGroup,
    FlyingSwordMember,
    FlyingSwordMode,
    type CreateFlyingSwordGroupOptions,
    type CreateFlyingSwordOptions,
    type ReadonlyVector3,
} from "./types";
import {
    FocusFlyingSwordRequest,
    FocusFlyingSwordRequestStorage,
    FlyingSwordFlightStorage,
    FlyingSwordControlStorage,
    FlyingSwordFormationStorage,
    FlyingSwordFormationGoal3Storage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupStorage,
    FlyingSwordGroupTarget3Storage,
    FlyingSwordMemberStorage,
    SetFlyingSwordCenterRequest,
    SetFlyingSwordCenterRequestStorage,
    SetFlyingSwordModeRequest,
    SetFlyingSwordModeRequestStorage,
} from "./runtime/storage";

/**
 * 飞剑领域的窄操作入口。
 *
 * 创建操作提交 Commands；战术指令写入请求队列并在下一固定 Tick 生效。
 */
export class FlyingSwordService extends Service {
    @Inject.service(Commands) private readonly commands!: Commands;

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
            .add(FlyingSwordGroupCenter3Storage)
            .add(FlyingSwordGroupTarget3Storage)
            .add(FlyingSwordFormationStorage)
            .add(FlyingSwordControlStorage)
            .set(FlyingSwordGroupStorage, FlyingSwordGroup.Owner, options.owner)
            .set(FlyingSwordGroupCenter3Storage, Float3.X, center.x)
            .set(FlyingSwordGroupCenter3Storage, Float3.Y, center.y)
            .set(FlyingSwordGroupCenter3Storage, Float3.Z, center.z)
            .set(FlyingSwordGroupTarget3Storage, Float3.X, center.x)
            .set(FlyingSwordGroupTarget3Storage, Float3.Y, center.y)
            .set(FlyingSwordGroupTarget3Storage, Float3.Z, center.z)
            .set(FlyingSwordFormationStorage, FlyingSwordFormation.OrbitRadius, orbitRadius)
            .set(FlyingSwordFormationStorage, FlyingSwordFormation.OrbitHeight, orbitHeight)
            .set(FlyingSwordFormationStorage, FlyingSwordFormation.AngularSpeed, angularSpeed)
            .set(
                FlyingSwordFormationStorage,
                FlyingSwordFormation.VerticalAmplitude,
                verticalAmplitude,
            )
            .set(FlyingSwordFormationStorage, FlyingSwordFormation.VerticalSpeed, verticalSpeed)
            .set(FlyingSwordFormationStorage, FlyingSwordFormation.Size, formationSize)
            .set(FlyingSwordControlStorage, FlyingSwordControl.Mode, FlyingSwordMode.Orbit)
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
        this.setMode(group, FlyingSwordMode.Orbit);
    }

    recall(group: Entity): void {
        this.setMode(group, FlyingSwordMode.Recall);
    }

    focus(group: Entity, target: ReadonlyVector3): void {
        vector("target", target);
        this.commands
            .spawn()
            .add(FocusFlyingSwordRequestStorage)
            .set(
                FocusFlyingSwordRequestStorage,
                FocusFlyingSwordRequest.Group,
                group,
            )
            .set(
                FocusFlyingSwordRequestStorage,
                FocusFlyingSwordRequest.TargetX,
                target.x,
            )
            .set(
                FocusFlyingSwordRequestStorage,
                FocusFlyingSwordRequest.TargetY,
                target.y,
            )
            .set(
                FocusFlyingSwordRequestStorage,
                FocusFlyingSwordRequest.TargetZ,
                target.z,
            )
            .submit();
    }

    setCenter(group: Entity, center: ReadonlyVector3): void {
        vector("center", center);
        this.commands
            .spawn()
            .add(SetFlyingSwordCenterRequestStorage)
            .set(
                SetFlyingSwordCenterRequestStorage,
                SetFlyingSwordCenterRequest.Group,
                group,
            )
            .set(
                SetFlyingSwordCenterRequestStorage,
                SetFlyingSwordCenterRequest.X,
                center.x,
            )
            .set(
                SetFlyingSwordCenterRequestStorage,
                SetFlyingSwordCenterRequest.Y,
                center.y,
            )
            .set(
                SetFlyingSwordCenterRequestStorage,
                SetFlyingSwordCenterRequest.Z,
                center.z,
            )
            .submit();
    }

    private setMode(group: Entity, mode: FlyingSwordMode): void {
        this.commands
            .spawn()
            .add(SetFlyingSwordModeRequestStorage)
            .set(
                SetFlyingSwordModeRequestStorage,
                SetFlyingSwordModeRequest.Group,
                group,
            )
            .set(
                SetFlyingSwordModeRequestStorage,
                SetFlyingSwordModeRequest.Mode,
                mode,
            )
            .submit();
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
    if (!Number.isFinite(value.x)) {
        throw new RangeError(`${name}.x must be finite`);
    }
    if (!Number.isFinite(value.y)) {
        throw new RangeError(`${name}.y must be finite`);
    }
    if (!Number.isFinite(value.z)) {
        throw new RangeError(`${name}.z must be finite`);
    }
}
