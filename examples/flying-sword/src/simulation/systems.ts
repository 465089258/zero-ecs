import {
    Commands,
    INVALID_ENTITY,
    Startup,
    SystemSet,
    Update,
    Write,
    defSystem,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    Direction3Type,
    Float3,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
} from "@zero-ecs/math/3d";
import {
    MotionSystemSet,
    MoveTowards3,
    MoveTowards3Type,
} from "@zero-ecs/motion/3d";
import {
    FlyingSwordFormationPlanId,
    FlyingSwordMode,
    FlyingSwordMember,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordStance,
    FlyingSwordSkillService,
    FlyingSwordSkillPhase,
    FlyingSwordSystemSet,
} from "@zero-ecs/flying-sword";
import {
    FlyingSwordVisual,
    FlyingSwordVisualType,
} from "../content/components";
import { RogueRunTuning } from "../content/run-tuning";
import { DemoRenderService } from "../presentation/render-service";
import {
    CultivatorControlQuery,
    CultivatorMoveActiveTag,
    CultivatorTag,
    MovingCultivatorQuery,
} from "./components";
import {
    DemoInputAction,
    DemoInputService,
    type DemoInputOut,
    type DemoMovementOut,
} from "./input-service";
import {
    AutoFlyingSwordSkill,
    AutoFlyingSwordSkillType,
    EnemyDirector,
    EnemyDirectorType,
    Health,
    HealthType,
    LevelExperience,
    LevelExperienceType,
    LightningSwordIntent,
    LightningSwordIntentType,
    MetalSwordIntent,
    MetalSwordIntentType,
    PlayerMovement,
    PlayerMovementType,
    PlayerPickup,
    PlayerPickupType,
    PlayerStamina,
    PlayerStaminaType,
    RogueRunClock,
    RogueRunClockType,
    RogueRunIdentity,
    RogueRunIdentityType,
    RogueRunPhase,
    RogueRunRandom,
    RogueRunRandomType,
    RogueRunStatistics,
    RogueRunStatisticsType,
    RogueRunStatus,
    RogueRunStatusType,
    RogueRunTarget,
    RogueRunTargetType,
    UpgradeSelection,
    UpgradeSelectionType,
    FlyingSwordCombat,
    FlyingSwordCombatType,
    FlyingSwordPiercingSequence,
    FlyingSwordPiercingSequenceType,
    SwordBodyUnity,
    SwordBodyUnityPiercingSequence,
    SwordBodyUnityPiercingSequenceType,
    SwordBodyUnityType,
} from "./rogue/components";
import {
    RogueRunQuery,
    SwordBodyUnityControlQuery,
} from "./rogue/queries";
import {
    steerDirection2Towards,
} from "./rogue/flying-sword/fusion-steering";
import { DemoSceneState } from "./state";

type Cultivators = QueryOf<typeof SwordBodyUnityControlQuery>;
type GroupCenterCultivators = QueryOf<typeof CultivatorControlQuery>;
type MovingCultivators = QueryOf<typeof MovingCultivatorQuery>;
type Runs = QueryOf<typeof RogueRunQuery>;
type FlyingSwords = QueryOf<typeof FlyingSwordQuery>;

export const setupFlyingSwordDemoSystem = defSystem(
    Startup,
    setupFlyingSwordDemo,
    [
        Commands,
        FlyingSwordService,
        RogueRunTuning,
        Write(DemoSceneState),
    ],
);

export const consumeFlyingSwordInputSystem = defSystem(
    Update.fixed,
    consumeFlyingSwordInput,
    [
        Commands,
        TimeState,
        DemoInputService,
        DemoRenderService,
        FlyingSwordService,
        FlyingSwordSkillService,
        Write(DemoSceneState),
        SwordBodyUnityControlQuery,
        RogueRunQuery,
        FlyingSwordQuery,
    ],
);

export const synchronizeFlyingSwordGroupCenterSystem = defSystem(
    Update.fixed,
    synchronizeFlyingSwordGroupCenter,
    [
        FlyingSwordService,
        DemoSceneState,
        CultivatorControlQuery,
    ],
);

export const resolveCultivatorMovementSystem = defSystem(
    Update.fixed,
    resolveCultivatorMovement,
    [Commands, MovingCultivatorQuery, Write(DemoSceneState)],
);

const DemoSimulationSystemSet = Object.freeze({
    Input: new SystemSet(Update.fixed, "flying-sword-demo:input"),
    GroupCenter: new SystemSet(
        Update.fixed,
        "flying-sword-demo:group-center",
    ),
    MovementResult: new SystemSet(
        Update.fixed,
        "flying-sword-demo:movement-result",
    ),
});

export const DemoInputSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.Input,
    before: FlyingSwordSystemSet.Request,
});

export const DemoGroupCenterSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.GroupCenter,
    after: DemoSimulationSystemSet.Input,
    before: FlyingSwordSystemSet.Request,
});

export const DemoMovementResultSystemOptions = Object.freeze({
    inSet: DemoSimulationSystemSet.MovementResult,
    after: MotionSystemSet.Integrate3,
});

function setupFlyingSwordDemo(
    commands: Commands,
    flyingSwords: FlyingSwordService,
    tuning: Readonly<RogueRunTuning>,
    scene: Mut<DemoSceneState>,
): void {
    const cultivatorCommand = commands.spawn();
    const cultivator = cultivatorCommand.entity;
    cultivatorCommand
        .add(Position3Type)
        .add(PreviousPosition3Type)
        .add(Velocity3Type)
        .add(Direction3Type)
        .add(MoveTowards3Type)
        .add(CultivatorTag)
        .add(HealthType)
        .add(PlayerMovementType)
        .add(LevelExperienceType)
        .add(PlayerPickupType)
        .add(PlayerStaminaType)
        .add(SwordBodyUnityType)
        .add(SwordBodyUnityPiercingSequenceType)
        .set(Position3Type, Float3.X, 0)
        .set(Position3Type, Float3.Y, 0)
        .set(Position3Type, Float3.Z, 0)
        .set(PreviousPosition3Type, Float3.X, 0)
        .set(PreviousPosition3Type, Float3.Y, 0)
        .set(PreviousPosition3Type, Float3.Z, 0)
        .set(Velocity3Type, Float3.X, 0)
        .set(Velocity3Type, Float3.Y, 0)
        .set(Velocity3Type, Float3.Z, 0)
        .set(Direction3Type, Float3.X, 0)
        .set(Direction3Type, Float3.Y, 0)
        .set(Direction3Type, Float3.Z, 1)
        .set(MoveTowards3Type, MoveTowards3.TargetX, 0)
        .set(MoveTowards3Type, MoveTowards3.TargetY, 0)
        .set(MoveTowards3Type, MoveTowards3.TargetZ, 0)
        .set(MoveTowards3Type, MoveTowards3.MaximumSpeed, 5.4)
        .set(MoveTowards3Type, MoveTowards3.Acceleration, 48)
        .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0.04)
        .set(HealthType, Health.Current, 100)
        .set(HealthType, Health.Maximum, 100)
        .set(PlayerMovementType, PlayerMovement.Speed, 5.4)
        .set(LevelExperienceType, LevelExperience.Level, 1)
        .set(LevelExperienceType, LevelExperience.Current, 0)
        .set(LevelExperienceType, LevelExperience.Required, 13)
        .set(LevelExperienceType, LevelExperience.PendingChoices, 0)
        .set(PlayerPickupType, PlayerPickup.AttractionRadius, 4.5)
        .set(PlayerPickupType, PlayerPickup.PickupRadius, 0.65)
        .set(PlayerPickupType, PlayerPickup.AttractionSpeed, 8)
        .set(
            PlayerStaminaType,
            PlayerStamina.Current,
            tuning.initialStamina,
        )
        .set(
            PlayerStaminaType,
            PlayerStamina.Maximum,
            tuning.initialStamina,
        )
        .set(
            PlayerStaminaType,
            PlayerStamina.DrainPerSecond,
            tuning.fusionStaminaDrainPerSecond,
        )
        .set(
            PlayerStaminaType,
            PlayerStamina.RecoveryPerSecond,
            tuning.staminaRecoveryPerSecond,
        )
        .set(
            PlayerStaminaType,
            PlayerStamina.RestartThreshold,
            tuning.fusionRestartStamina,
        )
        .set(SwordBodyUnityType, SwordBodyUnity.Active, 0)
        .set(SwordBodyUnityType, SwordBodyUnity.StartTick, 0)
        .set(SwordBodyUnityType, SwordBodyUnity.DirectionX, 0)
        .set(SwordBodyUnityType, SwordBodyUnity.DirectionZ, 1)
        .set(SwordBodyUnityType, SwordBodyUnity.Damage, 42)
        .set(
            SwordBodyUnityType,
            SwordBodyUnity.Group,
            INVALID_ENTITY,
        )
        .set(
            SwordBodyUnityPiercingSequenceType,
            SwordBodyUnityPiercingSequence.StartTick,
            0,
        )
        .set(
            SwordBodyUnityPiercingSequenceType,
            SwordBodyUnityPiercingSequence.HitCount,
            0,
        )
        .submit();
    const flyingSwordCount = readFlyingSwordCount();
    const group = flyingSwords.createGroup({
        owner: cultivator,
        center: { x: 0, y: 0, z: 0 },
        formationSize: flyingSwordCount,
        orbitRadius: tuning.initialFormationRadius,
        orbitHeight: 1.35,
        angularSpeed: tuning.initialFormationAngularSpeed,
        verticalAmplitude: 0.35,
        verticalSpeed: 2.7,
    });
    commands
        .entity(cultivator)
        .set(SwordBodyUnityType, SwordBodyUnity.Group, group)
        .submit();
    for (let slot = 0; slot < flyingSwordCount; slot++) {
        const sword = flyingSwords.createSword({
            group,
            position: {
                x: (slot - 3) * 0.16,
                y: 0.7 + slot * 0.08,
                z: -0.9,
            },
            slot,
            maximumSpeed: 13,
            acceleration: 42,
        });
        commands
            .entity(sword)
            .add(FlyingSwordVisualType)
            .add(FlyingSwordCombatType)
            .add(FlyingSwordPiercingSequenceType)
            .set(FlyingSwordVisualType, FlyingSwordVisual.Id, slot)
            .set(
                FlyingSwordCombatType,
                FlyingSwordCombat.Target,
                INVALID_ENTITY,
            )
            .set(
                FlyingSwordCombatType,
                FlyingSwordCombat.NextAttackTick,
                0,
            )
            .set(
                FlyingSwordPiercingSequenceType,
                FlyingSwordPiercingSequence.Action,
                INVALID_ENTITY,
            )
            .set(
                FlyingSwordPiercingSequenceType,
                FlyingSwordPiercingSequence.HitCount,
                0,
            )
            .submit();
    }
    commands
        .entity(group)
        .add(AutoFlyingSwordSkillType)
        .add(LightningSwordIntentType)
        .add(MetalSwordIntentType)
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.ReattackDelayTicks,
            6,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.TargetRadius,
            28,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.Damage,
            18,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.FocusDamageMultiplier,
            1,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.FormationDamageMultiplier,
            0.38,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.FormationContactCooldownTicks,
            9,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.ScatterLaunchCadenceTicks,
            7,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.ScatterLaunchSlotStride,
            3,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.FormationRadius,
            tuning.initialFormationRadius,
        )
        .set(
            AutoFlyingSwordSkillType,
            AutoFlyingSwordSkill.FormationAngularSpeed,
            tuning.initialFormationAngularSpeed,
        )
        .set(
            LightningSwordIntentType,
            LightningSwordIntent.ChainCount,
            0,
        )
        .set(
            LightningSwordIntentType,
            LightningSwordIntent.ChainRadius,
            6,
        )
        .set(
            LightningSwordIntentType,
            LightningSwordIntent.DamageMultiplier,
            0.55,
        )
        .set(
            MetalSwordIntentType,
            MetalSwordIntent.MaximumMomentum,
            0,
        )
        .set(
            MetalSwordIntentType,
            MetalSwordIntent.DamagePerMomentum,
            0.2,
        )
        .submit();

    commands
        .spawn()
        .add(RogueRunIdentityType)
        .add(RogueRunClockType)
        .add(RogueRunStatusType)
        .add(RogueRunRandomType)
        .add(RogueRunStatisticsType)
        .add(EnemyDirectorType)
        .add(RogueRunTargetType)
        .add(UpgradeSelectionType)
        .set(
            RogueRunIdentityType,
            RogueRunIdentity.Player,
            cultivator,
        )
        .set(
            RogueRunIdentityType,
            RogueRunIdentity.SwordGroup,
            group,
        )
        .set(RogueRunClockType, RogueRunClock.Tick, 0)
        .set(
            RogueRunStatusType,
            RogueRunStatus.Phase,
            RogueRunPhase.Playing,
        )
        .set(RogueRunRandomType, RogueRunRandom.Seed, tuning.seed)
        .set(RogueRunRandomType, RogueRunRandom.State, tuning.seed)
        .set(RogueRunStatisticsType, RogueRunStatistics.Kills, 0)
        .set(
            RogueRunStatisticsType,
            RogueRunStatistics.ActiveEnemies,
            0,
        )
        .set(EnemyDirectorType, EnemyDirector.Budget, 0)
        .set(
            EnemyDirectorType,
            EnemyDirector.InitialTarget,
            tuning.initialEnemyTarget,
        )
        .set(EnemyDirectorType, EnemyDirector.SpawnSerial, 0)
        .set(RogueRunTargetType, RogueRunTarget.MoveX, 0)
        .set(RogueRunTargetType, RogueRunTarget.MoveY, 0)
        .set(RogueRunTargetType, RogueRunTarget.MoveZ, 0)
        .set(RogueRunTargetType, RogueRunTarget.HasMove, 0)
        .set(RogueRunTargetType, RogueRunTarget.SkillX, 0)
        .set(RogueRunTargetType, RogueRunTarget.SkillY, 0)
        .set(RogueRunTargetType, RogueRunTarget.SkillZ, 5)
        .set(UpgradeSelectionType, UpgradeSelection.Active, 0)
        .set(UpgradeSelectionType, UpgradeSelection.OptionA, 0)
        .set(UpgradeSelectionType, UpgradeSelection.OptionB, 1)
        .set(UpgradeSelectionType, UpgradeSelection.OptionC, 2)
        .submit();

    scene.cultivator = cultivator;
    scene.swordGroup = group;
}

function readFlyingSwordCount(): number {
    const raw =
        new URLSearchParams(window.location.search).get("swords");
    if (raw === null) return DEFAULT_FLYING_SWORD_COUNT;
    const count = Number(raw);
    return (
        Number.isSafeInteger(count) &&
        count >= 1 &&
        count <= MAX_FLYING_SWORD_COUNT
    )
        ? count
        : DEFAULT_FLYING_SWORD_COUNT;
}

const input: DemoInputOut = {
    action: DemoInputAction.None,
    clientX: 0,
    clientY: 0,
};
const movement: DemoMovementOut = { right: 0, forward: 0 };
const target = { x: 0, y: 0, z: 0 };
const groupCenter = { x: 0, y: 0, z: 0 };
const DEFAULT_FLYING_SWORD_COUNT = 7;
const MAX_FLYING_SWORD_COUNT = 2000;
const FUSION_DASH_SPEED = 30;
const FUSION_DASH_ACCELERATION = 180;
const FUSION_DASH_ARRIVAL_RADIUS = 0.08;
const FUSION_RELEASE_ACCELERATION = 48;
const FUSION_TARGET_LOOKAHEAD = 12;
const FUSION_TURN_RADIANS_PER_SECOND = 1.35;

function consumeFlyingSwordInput(
    commands: Commands,
    time: Readonly<TimeState>,
    inputService: DemoInputService,
    renderer: DemoRenderService,
    flyingSwords: FlyingSwordService,
    skills: FlyingSwordSkillService,
    scene: Mut<DemoSceneState>,
    cultivators: Cultivators,
    runs: Runs,
    swords: FlyingSwords,
): void {
    const fusionHeld = inputService.readFusion(input);
    const hasFusionTarget = fusionHeld &&
        renderer.clientToGround(
            input.clientX,
            input.clientY,
            target,
        );
    const fusionActive = driveSwordBodyUnity(
        commands,
        time,
        flyingSwords,
        skills,
        scene,
        cultivators,
        fusionHeld,
        hasFusionTarget,
        target.x,
        target.z,
    );
    const keyboardMoving = !fusionActive &&
        inputService.readMovement(movement);
    if (keyboardMoving) {
        setCultivatorKeyboardMovement(
            commands,
            cultivators,
            scene,
            movement.right,
            movement.forward,
        );
    } else if (keyboardWasMoving && !fusionActive) {
        stopCultivatorKeyboardMovement(commands, cultivators, scene);
    }
    keyboardWasMoving = keyboardMoving;
    if (!inputService.consume(input)) return;
    if (fusionActive) return;
    if (input.action === DemoInputAction.Move) {
        if (
            !renderer.clientToGround(
                input.clientX,
                input.clientY,
                target,
            )
        ) {
            return;
        }
        if (
            !setCultivatorDestination(
                commands,
                cultivators,
                scene.cultivator,
                target.x,
                target.z,
            )
        ) {
            return;
        }
        scene.moveTargetX = target.x;
        scene.moveTargetY = target.y;
        scene.moveTargetZ = target.z;
        scene.hasMoveTarget = true;
    } else if (input.action === DemoInputAction.Focus) {
        if (
            !renderer.clientToGround(
                input.clientX,
                input.clientY,
                target,
            )
        ) {
            return;
        }
        flyingSwords.cancelGroupAttacks(scene.swordGroup);
        assignFlyingSwordSkillTarget(
            skills,
            swords,
            scene.swordGroup,
            target.x,
            target.y,
            target.z,
        );
        skills.cast({
            group: scene.swordGroup,
            target,
        });
        scene.targetX = target.x;
        scene.targetY = target.y;
        scene.targetZ = target.z;
        setRogueSkillTarget(runs, target.x, target.y, target.z);
    } else if (input.action === DemoInputAction.ToggleFormation) {
        skills.cancel(scene.swordGroup);
        flyingSwords.cancelGroupAttacks(scene.swordGroup);
        flyingSwords.orbit(scene.swordGroup);
        scene.stance = scene.stance === FlyingSwordStance.Formation
            ? FlyingSwordStance.Scatter
            : scene.stance === FlyingSwordStance.Scatter
                ? FlyingSwordStance.Formation
                : FlyingSwordStance.Scatter;
        flyingSwords.setStance(scene.swordGroup, scene.stance);
        scene.mode = FlyingSwordMode.Orbit;
    } else if (input.action === DemoInputAction.Recall) {
        skills.cancel(scene.swordGroup);
        flyingSwords.cancelGroupAttacks(scene.swordGroup);
        flyingSwords.recall(scene.swordGroup);
        flyingSwords.setStance(
            scene.swordGroup,
            FlyingSwordStance.Guard,
        );
        scene.stance = FlyingSwordStance.Guard;
        scene.mode = FlyingSwordMode.Recall;
    } else if (
        input.action === DemoInputAction.ToggleFormationPlan
    ) {
        scene.formationPlan =
            scene.formationPlan ===
                FlyingSwordFormationPlanId.EightGates
                ? FlyingSwordFormationPlanId.Lotus
                : FlyingSwordFormationPlanId.EightGates;
        flyingSwords.setFormationPlan(
            scene.swordGroup,
            scene.formationPlan,
        );
    }
}

let keyboardWasMoving = false;

function driveSwordBodyUnity(
    commands: Commands,
    time: Readonly<TimeState>,
    flyingSwords: FlyingSwordService,
    skills: FlyingSwordSkillService,
    scene: Mut<DemoSceneState>,
    cultivators: Cultivators,
    fusionHeld: boolean,
    hasTarget: boolean,
    targetX: number,
    targetZ: number,
): boolean {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            positions,
            motion,
            velocities,
            ,
            movement,
            stamina,
            actions,
        ] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const velocityXs = velocities[Float3.X];
        const velocityYs = velocities[Float3.Y];
        const velocityZs = velocities[Float3.Z];
        const motionTargetXs = motion[MoveTowards3.TargetX];
        const motionTargetYs = motion[MoveTowards3.TargetY];
        const motionTargetZs = motion[MoveTowards3.TargetZ];
        const maximumSpeeds = motion[MoveTowards3.MaximumSpeed];
        const accelerations = motion[MoveTowards3.Acceleration];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];
        const movementSpeeds = movement[PlayerMovement.Speed];
        const currentStamina = stamina[PlayerStamina.Current];
        const maximumStamina = stamina[PlayerStamina.Maximum];
        const drainPerSecond = stamina[PlayerStamina.DrainPerSecond];
        const recoveryPerSecond =
            stamina[PlayerStamina.RecoveryPerSecond];
        const restartThreshold =
            stamina[PlayerStamina.RestartThreshold];
        const active = actions[SwordBodyUnity.Active];
        const startTicks = actions[SwordBodyUnity.StartTick];
        const directionXs = actions[SwordBodyUnity.DirectionX];
        const directionZs = actions[SwordBodyUnity.DirectionZ];
        const groups = actions[SwordBodyUnity.Group];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== scene.cultivator) continue;
            if (active[row] !== 0) {
                currentStamina[row] = Math.max(
                    0,
                    currentStamina[row] -
                        drainPerSecond[row] * time.delta,
                );
                if (!fusionHeld || currentStamina[row] <= 0) {
                    stopSwordBodyUnity(
                        commands,
                        flyingSwords,
                        entities[row],
                        row,
                        xs,
                        ys,
                        zs,
                        velocityXs,
                        velocityYs,
                        velocityZs,
                        motionTargetXs,
                        motionTargetYs,
                        motionTargetZs,
                        maximumSpeeds,
                        accelerations,
                        arrivalRadii,
                        movementSpeeds,
                        active,
                        groups,
                    );
                    return false;
                }
                if (
                    hasTarget &&
                    steerDirection2Towards(
                        directionXs,
                        directionZs,
                        row,
                        targetX - xs[row],
                        targetZ - zs[row],
                        FUSION_TURN_RADIANS_PER_SECOND * time.delta,
                    )
                ) {
                    flyingSwords.steerFusionSpiral(
                        groups[row] as Entity,
                        directionXs[row],
                        directionZs[row],
                    );
                }
                motionTargetXs[row] =
                    xs[row] +
                    directionXs[row] * FUSION_TARGET_LOOKAHEAD;
                motionTargetYs[row] = ys[row];
                motionTargetZs[row] =
                    zs[row] +
                    directionZs[row] * FUSION_TARGET_LOOKAHEAD;
                maximumSpeeds[row] = FUSION_DASH_SPEED;
                accelerations[row] = FUSION_DASH_ACCELERATION;
                arrivalRadii[row] = FUSION_DASH_ARRIVAL_RADIUS;
                scene.hasMoveTarget = false;
                return true;
            }

            currentStamina[row] = Math.min(
                maximumStamina[row],
                currentStamina[row] +
                    recoveryPerSecond[row] * time.delta,
            );
            if (
                !fusionHeld ||
                !hasTarget ||
                currentStamina[row] < restartThreshold[row] ||
                skills.phase(scene.swordGroup) !==
                    FlyingSwordSkillPhase.Idle
            ) {
                return false;
            }
            const dx = targetX - xs[row];
            const dz = targetZ - zs[row];
            const length = Math.sqrt(dx * dx + dz * dz);
            if (length <= 1e-5) return false;
            const inverseLength = 1 / length;
            const directionX = dx * inverseLength;
            const directionZ = dz * inverseLength;
            motionTargetXs[row] =
                xs[row] + directionX * FUSION_TARGET_LOOKAHEAD;
            motionTargetYs[row] = ys[row];
            motionTargetZs[row] =
                zs[row] + directionZ * FUSION_TARGET_LOOKAHEAD;
            maximumSpeeds[row] = FUSION_DASH_SPEED;
            accelerations[row] = FUSION_DASH_ACCELERATION;
            arrivalRadii[row] = FUSION_DASH_ARRIVAL_RADIUS;
            active[row] = 1;
            startTicks[row] = time.tick;
            directionXs[row] = directionX;
            directionZs[row] = directionZ;
            groups[row] = scene.swordGroup;
            commands
                .entity(scene.cultivator)
                .add(CultivatorMoveActiveTag)
                .submit();
            flyingSwords.beginFusionSpiral(
                scene.swordGroup,
                directionX,
                directionZ,
            );
            scene.hasMoveTarget = false;
            return true;
        }
    }
    return false;
}

function stopSwordBodyUnity(
    commands: Commands,
    flyingSwords: FlyingSwordService,
    entity: Entity,
    row: number,
    xs: Float32Array,
    ys: Float32Array,
    zs: Float32Array,
    velocityXs: Float32Array,
    velocityYs: Float32Array,
    velocityZs: Float32Array,
    targetXs: Float32Array,
    targetYs: Float32Array,
    targetZs: Float32Array,
    maximumSpeeds: Float32Array,
    accelerations: Float32Array,
    arrivalRadii: Float32Array,
    movementSpeeds: Float32Array,
    active: Uint8Array,
    groups: Uint32Array,
): void {
    active[row] = 0;
    targetXs[row] = xs[row];
    targetYs[row] = ys[row];
    targetZs[row] = zs[row];
    maximumSpeeds[row] = movementSpeeds[row];
    accelerations[row] = FUSION_RELEASE_ACCELERATION;
    arrivalRadii[row] = FUSION_DASH_ARRIVAL_RADIUS;
    velocityXs[row] = 0;
    velocityYs[row] = 0;
    velocityZs[row] = 0;
    commands
        .entity(entity)
        .remove(CultivatorMoveActiveTag)
        .submit();
    const group = groups[row];
    groups[row] = INVALID_ENTITY;
    if (group !== INVALID_ENTITY) {
        flyingSwords.endActiveFormation(group as Entity);
    }
}

function setRogueSkillTarget(
    runs: Runs,
    x: number,
    y: number,
    z: number,
): void {
    const iter = runs.iter();
    while (iter.next()) {
        const [count, , , , , , , , targets] = iter.current;
        if (count === 0) continue;
        const xs = targets[RogueRunTarget.SkillX];
        const ys = targets[RogueRunTarget.SkillY];
        const zs = targets[RogueRunTarget.SkillZ];
        xs[0] = x;
        ys[0] = y;
        zs[0] = z;
        return;
    }
}

function assignFlyingSwordSkillTarget(
    skills: FlyingSwordSkillService,
    swords: FlyingSwords,
    group: number,
    x: number,
    y: number,
    z: number,
): void {
    target.x = x;
    target.y = y;
    target.z = z;
    const iter = swords.iter();
    while (iter.next()) {
        const [count, entities, members] = iter.current;
        const groups = members[FlyingSwordMember.Group];
        for (let row = 0; row < count; row++) {
            if (groups[row] !== group) continue;
            skills.setSkillTarget(entities[row], target);
        }
    }
}

function setCultivatorKeyboardMovement(
    commands: Commands,
    cultivators: Cultivators,
    scene: Mut<DemoSceneState>,
    right: number,
    forward: number,
): void {
    const length = Math.sqrt(right * right + forward * forward);
    if (length <= 1e-6) return;
    const normalizedRight = right / length;
    const normalizedForward = forward / length;
    const worldX =
        (normalizedForward + normalizedRight) * Math.SQRT1_2;
    const worldZ =
        (normalizedForward - normalizedRight) * Math.SQRT1_2;
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions, motion] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== scene.cultivator) continue;
            targetXs[row] = xs[row] + worldX * 12;
            targetYs[row] = ys[row];
            targetZs[row] = zs[row] + worldZ * 12;
            commands
                .entity(entities[row])
                .add(CultivatorMoveActiveTag)
                .submit();
            scene.hasMoveTarget = false;
            return;
        }
    }
}

function stopCultivatorKeyboardMovement(
    commands: Commands,
    cultivators: Cultivators,
    scene: Mut<DemoSceneState>,
): void {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions, motion] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== scene.cultivator) continue;
            targetXs[row] = xs[row];
            targetYs[row] = ys[row];
            targetZs[row] = zs[row];
            commands
                .entity(entities[row])
                .remove(CultivatorMoveActiveTag)
                .submit();
            scene.hasMoveTarget = false;
            return;
        }
    }
}

function setCultivatorDestination(
    commands: Commands,
    cultivators: Cultivators,
    entity: number,
    x: number,
    z: number,
): boolean {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions, motion] = iter.current;
        const ys = positions[Float3.Y];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== entity) continue;
            targetXs[row] = x;
            targetYs[row] = ys[row];
            targetZs[row] = z;
            commands
                .entity(entities[row])
                .add(CultivatorMoveActiveTag)
                .submit();
            return true;
        }
    }
    return false;
}

function synchronizeFlyingSwordGroupCenter(
    flyingSwords: FlyingSwordService,
    scene: Readonly<DemoSceneState>,
    cultivators: GroupCenterCultivators,
): void {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== scene.cultivator) continue;
            groupCenter.x = xs[row];
            groupCenter.y = ys[row];
            groupCenter.z = zs[row];
            flyingSwords.setCenter(scene.swordGroup, groupCenter);
            return;
        }
    }
}

function resolveCultivatorMovement(
    commands: Commands,
    cultivators: MovingCultivators,
    scene: Mut<DemoSceneState>,
): void {
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions, motion] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];
        for (let row = 0; row < count; row++) {
            const dx = targetXs[row] - xs[row];
            const dy = targetYs[row] - ys[row];
            const dz = targetZs[row] - zs[row];
            const radius = arrivalRadii[row];
            if (dx * dx + dy * dy + dz * dz > radius * radius) {
                continue;
            }
            commands
                .entity(entities[row])
                .remove(CultivatorMoveActiveTag)
                .submit();
            if (entities[row] === scene.cultivator) {
                scene.hasMoveTarget = false;
            }
        }
    }
}
