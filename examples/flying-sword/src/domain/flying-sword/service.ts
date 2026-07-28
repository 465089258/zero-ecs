/** 飞剑示例本地领域实现。 */
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
import { FlyingSwordFormationCatalog } from "./formation-catalog";
import { FlyingSwordFormationPlanId } from "./formation-types";
import {
    FlyingSwordFlight,
    FlyingSwordActiveFormation,
    FlyingSwordBehavior,
    FlyingSwordControl,
    FlyingSwordFormation,
    FlyingSwordFormationPlan,
    FlyingSwordGroup,
    FlyingSwordMember,
    FlyingSwordMode,
    FlyingSwordStance,
    type CreateFlyingSwordGroupOptions,
    type CreateFlyingSwordOptions,
    type ReadonlyVector3,
} from "./types";
import {
    FocusFlyingSwordRequest,
    FocusFlyingSwordRequestStorage,
    FlyingSwordFlightStorage,
    FlyingSwordControlStorage,
    FlyingSwordBehaviorStorage,
    FlyingSwordFormationStorage,
    FlyingSwordFormationPlanStorage,
    FlyingSwordFormationGoal3Storage,
    FlyingSwordIdleDirection3Storage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupStorage,
    FlyingSwordGroupTarget3Storage,
    FlyingSwordMemberStorage,
    SetFlyingSwordCenterRequest,
    SetFlyingSwordCenterRequestStorage,
    SetFlyingSwordModeRequest,
    SetFlyingSwordModeRequestStorage,
    SetFlyingSwordFormationSizeRequest,
    SetFlyingSwordFormationSizeRequestStorage,
    SetFlyingSwordFormationTuningRequest,
    SetFlyingSwordFormationTuningRequestStorage,
    SetFlyingSwordFormationPlanRequest,
    SetFlyingSwordFormationPlanRequestStorage,
    SetFlyingSwordStanceRequest,
    SetFlyingSwordStanceRequestStorage,
    SetFlyingSwordActiveFormationRequest,
    SetFlyingSwordActiveFormationRequestStorage,
    StartFlyingSwordTaskRequest,
    StartFlyingSwordTaskRequestStorage,
    FinishFlyingSwordTaskRequest,
    FinishFlyingSwordTaskRequestStorage,
    CancelFlyingSwordGroupTasksRequest,
    CancelFlyingSwordGroupTasksRequestStorage,
} from "./runtime/storage";

/**
 * 飞剑领域的窄操作入口。
 *
 * 创建操作提交 Commands；战术指令写入请求队列并在下一固定 Tick 生效。
 */
export class FlyingSwordService extends Service {
    @Inject.service(Commands) private readonly commands!: Commands;
    @Inject.resource(FlyingSwordFormationCatalog)
    private readonly formationCatalog!: FlyingSwordFormationCatalog;

    createGroup(options: CreateFlyingSwordGroupOptions): Entity {
        const center = options.center ?? ZERO_VECTOR;
        const formationSize = integerInRange(
            "formationSize",
            options.formationSize ?? 7,
            1,
            0xffff,
        );
        const formationPlan =
            options.formationPlan ??
            FlyingSwordFormationPlanId.EightGates;
        this.formationCatalog.require(formationPlan);
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
            .add(FlyingSwordFormationPlanStorage)
            .add(FlyingSwordControlStorage)
            .add(FlyingSwordBehaviorStorage)
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
            .set(
                FlyingSwordFormationPlanStorage,
                FlyingSwordFormationPlan.Plan,
                formationPlan,
            )
            .set(FlyingSwordControlStorage, FlyingSwordControl.Mode, FlyingSwordMode.Orbit)
            .set(
                FlyingSwordBehaviorStorage,
                FlyingSwordBehavior.Stance,
                FlyingSwordStance.Scatter,
            )
            .set(
                FlyingSwordBehaviorStorage,
                FlyingSwordBehavior.ActiveFormation,
                FlyingSwordActiveFormation.None,
            )
            .set(
                FlyingSwordBehaviorStorage,
                FlyingSwordBehavior.ActiveForwardX,
                0,
            )
            .set(
                FlyingSwordBehaviorStorage,
                FlyingSwordBehavior.ActiveForwardZ,
                1,
            )
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
            .add(FlyingSwordIdleDirection3Storage)
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
            .set(FlyingSwordIdleDirection3Storage, Float3.X, 0)
            .set(FlyingSwordIdleDirection3Storage, Float3.Y, 1)
            .set(FlyingSwordIdleDirection3Storage, Float3.Z, 0)
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

    setFormationSize(group: Entity, size: number): void {
        const formationSize = integerInRange(
            "size",
            size,
            1,
            0xffff,
        );
        this.commands
            .spawn()
            .add(SetFlyingSwordFormationSizeRequestStorage)
            .set(
                SetFlyingSwordFormationSizeRequestStorage,
                SetFlyingSwordFormationSizeRequest.Group,
                group,
            )
            .set(
                SetFlyingSwordFormationSizeRequestStorage,
                SetFlyingSwordFormationSizeRequest.Size,
                formationSize,
            )
            .submit();
    }

    setFormationTuning(
        group: Entity,
        orbitRadius: number,
        angularSpeed: number,
    ): void {
        const radius = positive("orbitRadius", orbitRadius);
        const speed = finite("angularSpeed", angularSpeed);
        this.commands
            .spawn()
            .add(SetFlyingSwordFormationTuningRequestStorage)
            .set(
                SetFlyingSwordFormationTuningRequestStorage,
                SetFlyingSwordFormationTuningRequest.Group,
                group,
            )
            .set(
                SetFlyingSwordFormationTuningRequestStorage,
                SetFlyingSwordFormationTuningRequest.OrbitRadius,
                radius,
            )
            .set(
                SetFlyingSwordFormationTuningRequestStorage,
                SetFlyingSwordFormationTuningRequest.AngularSpeed,
                speed,
            )
            .submit();
    }

    setFormationPlan(group: Entity, plan: number): void {
        this.formationCatalog.require(plan);
        this.commands
            .spawn()
            .add(SetFlyingSwordFormationPlanRequestStorage)
            .set(
                SetFlyingSwordFormationPlanRequestStorage,
                SetFlyingSwordFormationPlanRequest.Group,
                group,
            )
            .set(
                SetFlyingSwordFormationPlanRequestStorage,
                SetFlyingSwordFormationPlanRequest.Plan,
                plan,
            )
            .submit();
    }

    setStance(group: Entity, stance: FlyingSwordStance): void {
        this.commands
            .spawn()
            .add(SetFlyingSwordStanceRequestStorage)
            .set(
                SetFlyingSwordStanceRequestStorage,
                SetFlyingSwordStanceRequest.Group,
                group,
            )
            .set(
                SetFlyingSwordStanceRequestStorage,
                SetFlyingSwordStanceRequest.Stance,
                stance,
            )
            .submit();
    }

    beginFusionSpiral(
        group: Entity,
        forwardX: number,
        forwardZ: number,
    ): void {
        const length = Math.sqrt(
            forwardX * forwardX + forwardZ * forwardZ,
        );
        const inverse = length > DIRECTION_EPSILON ? 1 / length : 0;
        this.cancelGroupTasks(group, true);
        this.setActiveFormation(
            group,
            FlyingSwordActiveFormation.FusionSpiral,
            length > DIRECTION_EPSILON ? forwardX * inverse : 0,
            length > DIRECTION_EPSILON ? forwardZ * inverse : 1,
        );
    }

    steerFusionSpiral(
        group: Entity,
        forwardX: number,
        forwardZ: number,
    ): void {
        const length = Math.sqrt(
            forwardX * forwardX + forwardZ * forwardZ,
        );
        if (length <= DIRECTION_EPSILON) return;
        const inverse = 1 / length;
        this.setActiveFormation(
            group,
            FlyingSwordActiveFormation.FusionSpiral,
            forwardX * inverse,
            forwardZ * inverse,
        );
    }

    endActiveFormation(group: Entity): void {
        this.setActiveFormation(
            group,
            FlyingSwordActiveFormation.None,
            0,
            1,
        );
    }

    attack(sword: Entity, target: ReadonlyVector3): void {
        vector("target", target);
        this.commands
            .spawn()
            .add(StartFlyingSwordTaskRequestStorage)
            .set(
                StartFlyingSwordTaskRequestStorage,
                StartFlyingSwordTaskRequest.Sword,
                sword,
            )
            .set(
                StartFlyingSwordTaskRequestStorage,
                StartFlyingSwordTaskRequest.TargetX,
                target.x,
            )
            .set(
                StartFlyingSwordTaskRequestStorage,
                StartFlyingSwordTaskRequest.TargetY,
                target.y,
            )
            .set(
                StartFlyingSwordTaskRequestStorage,
                StartFlyingSwordTaskRequest.TargetZ,
                target.z,
            )
            .submit();
    }

    finishAttack(sword: Entity): void {
        this.commands
            .spawn()
            .add(FinishFlyingSwordTaskRequestStorage)
            .set(
                FinishFlyingSwordTaskRequestStorage,
                FinishFlyingSwordTaskRequest.Sword,
                sword,
            )
            .submit();
    }

    cancelGroupAttacks(group: Entity): void {
        this.cancelGroupTasks(group, false);
    }

    private cancelGroupTasks(group: Entity, immediate: boolean): void {
        this.commands
            .spawn()
            .add(CancelFlyingSwordGroupTasksRequestStorage)
            .set(
                CancelFlyingSwordGroupTasksRequestStorage,
                CancelFlyingSwordGroupTasksRequest.Group,
                group,
            )
            .set(
                CancelFlyingSwordGroupTasksRequestStorage,
                CancelFlyingSwordGroupTasksRequest.Immediate,
                immediate ? 1 : 0,
            )
            .submit();
    }

    private setActiveFormation(
        group: Entity,
        formation: FlyingSwordActiveFormation,
        forwardX: number,
        forwardZ: number,
    ): void {
        this.commands
            .spawn()
            .add(SetFlyingSwordActiveFormationRequestStorage)
            .set(
                SetFlyingSwordActiveFormationRequestStorage,
                SetFlyingSwordActiveFormationRequest.Group,
                group,
            )
            .set(
                SetFlyingSwordActiveFormationRequestStorage,
                SetFlyingSwordActiveFormationRequest.Formation,
                formation,
            )
            .set(
                SetFlyingSwordActiveFormationRequestStorage,
                SetFlyingSwordActiveFormationRequest.ForwardX,
                forwardX,
            )
            .set(
                SetFlyingSwordActiveFormationRequestStorage,
                SetFlyingSwordActiveFormationRequest.ForwardZ,
                forwardZ,
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
const DIRECTION_EPSILON = 1e-6;

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
