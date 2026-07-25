import {
    Commands,
    INVALID_ENTITY,
    Startup,
    SystemSet,
    Update,
    World,
    Write,
    defSystem,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
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
    PlayerMovement,
    PlayerMovementType,
    PlayerPickup,
    PlayerPickupType,
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
    SwordBodyUnity,
    SwordBodyUnityType,
} from "./rogue/components";
import { RogueRunQuery } from "./rogue/queries";
import { DemoSceneState } from "./state";

type Cultivators = QueryOf<typeof CultivatorControlQuery>;
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
        World,
        DemoInputService,
        DemoRenderService,
        FlyingSwordService,
        FlyingSwordSkillService,
        Write(DemoSceneState),
        CultivatorControlQuery,
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
        .add(SwordBodyUnityType)
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
        .set(SwordBodyUnityType, SwordBodyUnity.Active, 0)
        .set(SwordBodyUnityType, SwordBodyUnity.StartTick, 0)
        .set(SwordBodyUnityType, SwordBodyUnity.EndTick, 0)
        .set(SwordBodyUnityType, SwordBodyUnity.CooldownEndTick, 0)
        .set(SwordBodyUnityType, SwordBodyUnity.DirectionX, 0)
        .set(SwordBodyUnityType, SwordBodyUnity.DirectionZ, 1)
        .set(SwordBodyUnityType, SwordBodyUnity.Damage, 42)
        .set(
            SwordBodyUnityType,
            SwordBodyUnity.Group,
            INVALID_ENTITY,
        )
        .submit();
    const flyingSwordCount = readFlyingSwordCount();
    const group = flyingSwords.createGroup({
        owner: cultivator,
        center: { x: 0, y: 0, z: 0 },
        formationSize: flyingSwordCount,
        orbitRadius: 3.15,
        orbitHeight: 1.35,
        angularSpeed: 0.72,
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
            .set(FlyingSwordVisualType, FlyingSwordVisual.Id, slot)
            .set(
                FlyingSwordCombatType,
                FlyingSwordCombat.Target,
                INVALID_ENTITY,
            )
            .set(
                FlyingSwordCombatType,
                FlyingSwordCombat.FocusAction,
                INVALID_ENTITY,
            )
            .set(
                FlyingSwordCombatType,
                FlyingSwordCombat.FocusActionStartTick,
                0,
            )
            .set(
                FlyingSwordCombatType,
                FlyingSwordCombat.FocusHitConsumed,
                0,
            )
            .set(
                FlyingSwordCombatType,
                FlyingSwordCombat.NextAttackTick,
                0,
            )
            .submit();
    }
    commands
        .entity(group)
        .add(AutoFlyingSwordSkillType)
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
const FUSION_DASH_DISTANCE = 7.5;
const FUSION_DASH_SPEED = 30;
const FUSION_DASH_ACCELERATION = 180;
const FUSION_DASH_ARRIVAL_RADIUS = 0.08;
const FUSION_DASH_TICKS = 22;
const FUSION_COOLDOWN_TICKS = 150;

function consumeFlyingSwordInput(
    commands: Commands,
    world: World,
    inputService: DemoInputService,
    renderer: DemoRenderService,
    flyingSwords: FlyingSwordService,
    skills: FlyingSwordSkillService,
    scene: Mut<DemoSceneState>,
    cultivators: Cultivators,
    runs: Runs,
    swords: FlyingSwords,
): void {
    const fusionActive = world.get(
        scene.cultivator,
        SwordBodyUnityType,
        SwordBodyUnity.Active,
    ) === 1;
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
    } else if (input.action === DemoInputAction.Fusion) {
        if (
            !renderer.clientToGround(
                input.clientX,
                input.clientY,
                target,
            )
        ) {
            return;
        }
        startSwordBodyUnity(
            commands,
            world,
            flyingSwords,
            skills,
            scene,
            cultivators,
            runs,
            target.x,
            target.z,
        );
    }
}

let keyboardWasMoving = false;

function startSwordBodyUnity(
    commands: Commands,
    world: World,
    flyingSwords: FlyingSwordService,
    skills: FlyingSwordSkillService,
    scene: Mut<DemoSceneState>,
    cultivators: Cultivators,
    runs: Runs,
    targetX: number,
    targetZ: number,
): void {
    const tick = readRogueTick(runs);
    const active = world.get(
        scene.cultivator,
        SwordBodyUnityType,
        SwordBodyUnity.Active,
    );
    const cooldownEndTick = world.get(
        scene.cultivator,
        SwordBodyUnityType,
        SwordBodyUnity.CooldownEndTick,
    );
    if (
        active !== 0 ||
        cooldownEndTick === null ||
        tick < cooldownEndTick ||
        skills.phase(scene.swordGroup) !== FlyingSwordSkillPhase.Idle
    ) {
        return;
    }
    const iter = cultivators.iter();
    while (iter.next()) {
        const [count, entities, positions, motion] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const motionTargetXs = motion[MoveTowards3.TargetX];
        const motionTargetYs = motion[MoveTowards3.TargetY];
        const motionTargetZs = motion[MoveTowards3.TargetZ];
        const maximumSpeeds = motion[MoveTowards3.MaximumSpeed];
        const accelerations = motion[MoveTowards3.Acceleration];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== scene.cultivator) continue;
            const dx = targetX - xs[row];
            const dz = targetZ - zs[row];
            const length = Math.sqrt(dx * dx + dz * dz);
            if (length <= 1e-5) return;
            const inverseLength = 1 / length;
            const directionX = dx * inverseLength;
            const directionZ = dz * inverseLength;
            motionTargetXs[row] =
                xs[row] + directionX * FUSION_DASH_DISTANCE;
            motionTargetYs[row] = ys[row];
            motionTargetZs[row] =
                zs[row] + directionZ * FUSION_DASH_DISTANCE;
            maximumSpeeds[row] = FUSION_DASH_SPEED;
            accelerations[row] = FUSION_DASH_ACCELERATION;
            arrivalRadii[row] = FUSION_DASH_ARRIVAL_RADIUS;
            world.set(
                scene.cultivator,
                SwordBodyUnityType,
                SwordBodyUnity.Active,
                1,
            );
            world.set(
                scene.cultivator,
                SwordBodyUnityType,
                SwordBodyUnity.StartTick,
                tick,
            );
            world.set(
                scene.cultivator,
                SwordBodyUnityType,
                SwordBodyUnity.EndTick,
                tick + FUSION_DASH_TICKS,
            );
            world.set(
                scene.cultivator,
                SwordBodyUnityType,
                SwordBodyUnity.CooldownEndTick,
                tick + FUSION_COOLDOWN_TICKS,
            );
            world.set(
                scene.cultivator,
                SwordBodyUnityType,
                SwordBodyUnity.DirectionX,
                directionX,
            );
            world.set(
                scene.cultivator,
                SwordBodyUnityType,
                SwordBodyUnity.DirectionZ,
                directionZ,
            );
            world.set(
                scene.cultivator,
                SwordBodyUnityType,
                SwordBodyUnity.Group,
                scene.swordGroup,
            );
            commands
                .entity(scene.cultivator)
                .add(CultivatorMoveActiveTag)
                .submit();
            flyingSwords.cancelGroupAttacks(scene.swordGroup);
            flyingSwords.beginFusionSpiral(
                scene.swordGroup,
                directionX,
                directionZ,
            );
            scene.hasMoveTarget = false;
            return;
        }
    }
}

function readRogueTick(runs: Runs): number {
    const iter = runs.iter();
    while (iter.next()) {
        const [count, , , clocks] = iter.current;
        if (count > 0) return clocks[RogueRunClock.Tick][0];
    }
    return 0;
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
    cultivators: Cultivators,
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
