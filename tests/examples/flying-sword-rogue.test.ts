import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    Commands,
    GameBuilder,
    QueryType,
    Startup,
    Update,
    With,
    Write,
    defSystem,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    Float3,
    Position3Type,
    Velocity3Type,
} from "../../examples/flying-sword/src/infrastructure/math";
import {
    MoveTowards3,
    MoveTowards3Type,
} from "../../examples/flying-sword/src/infrastructure/motion";
import {
    nextRogueRandom,
    progressAlongSegment3,
    rogueRequiredExperienceFor,
    rollSwordOfferValues,
    swordContainerNeedsReplacement,
    squaredDistanceToSegment3,
    type SwordOfferRollOut,
} from "../../examples/flying-sword/src/simulation/rogue/systems";
import {
    clampFocusTargetDistance,
    focusManaDamageMultiplier,
} from "../../examples/flying-sword/src/simulation/systems";
import {
    EnemySpatialIndexState,
    GRID_CELL_SIZE,
    GRID_HALF_EXTENT,
    GRID_WIDTH,
    CombatScratchState,
    ColdSwordIntentAccessState,
    FireSwordIntentAccessState,
    FocusPiercingCandidateState,
    LightningChainAccessState,
    RogueEntityAccessState,
} from "../../examples/flying-sword/src/simulation/rogue/state";
import {
    RogueUpgrade,
    RogueUpgradeCatalog,
} from "../../examples/flying-sword/src/content/upgrades";

function createSwordOfferRollOut(): SwordOfferRollOut {
    return {
        blueprint: 0,
        quality: 0,
        recommendation: 0,
        minimumDamage: 0,
        maximumDamage: 0,
        attackIntervalTicks: 0,
        maximumSpeed: 0,
        acceleration: 0,
        maximumSpiritPower: 0,
        spiritRecoveryPerSecond: 0,
        scatterSpiritCost: 0,
        focusSpiritCost: 0,
        formationSpiritDrainPerSecond: 0,
    };
}
import {
    RogueRunTuning,
} from "../../examples/flying-sword/src/content/run-tuning";
import {
    SwordBlueprint,
    SwordBlueprintCatalog,
} from "../../examples/flying-sword/src/content/swords";
import {
    shouldLaunchScatterSword,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/scatter-system";
import {
    steerDirection2Towards,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/fusion-steering";
import {
    focusPiercingSegmentStartRatio,
    recordFocusSwordHit,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/focus-contact-system";
import {
    canTriggerLightningChain,
    chainLightningDamageSystem,
    findClosestLightningChainCandidate,
    lightningChainDamage,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/lightning-chain-system";
import {
    applyColdMovementModifierSystem,
    applyColdSwordIntentSystem,
    canTriggerColdSlow,
    coldSpeedMultiplier,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/cold-slow-system";
import {
    applyFireSwordIntentSystem,
    canTriggerFireBurst,
    fireBurstDamage,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/fire-burst-system";
import {
    applyMetalBreakSystem,
    canTriggerMetalBreak,
    metalBreakDamage,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/metal-break-system";
import {
    DamageKind,
    DamageRequest,
    DamageRequestType,
    EnemyBody,
    EnemyBodyType,
    EnemyColdAccumulation,
    EnemyColdAccumulationType,
    EnemyCombat,
    EnemyCombatType,
    EnemyEmpowerment,
    EnemyEmpowermentType,
    EnemyLocomotion,
    EnemyLocomotionType,
    EnemyFireAccumulation,
    EnemyFireAccumulationType,
    FlyingSwordDamageSource,
    FlyingSwordDamageSourceType,
    HealingKind,
    HealingRequest,
    HealingRequestType,
    PiercingDamage,
    PiercingDamageType,
    Health,
    HealthType,
    RogueRunClock,
    RogueRunClockType,
    RogueRunPhase,
    RogueRunStatus,
    RogueRunStatusType,
    StoneGolemCharge,
    StoneGolemChargePhase,
    StoneGolemChargeType,
    SwordWraithEmpowerment,
    SwordWraithEmpowermentType,
    PendingSwordReplacement,
    PendingSwordReplacementType,
    ReplaceSwordRequest,
    ReplaceSwordRequestType,
    SwordReplacementSelection,
    SwordReplacementSelectionType,
} from "../../examples/flying-sword/src/simulation/rogue/components";
import {
    RogueDamageRequestQuery,
    RogueColdEnemyQuery,
    RogueFireBurstQuery,
    RogueLightningArcQuery,
    RogueRunPhaseQuery,
    RogueStoneGolemChargeQuery,
    RogueSwordWraithEmpowermentQuery,
} from "../../examples/flying-sword/src/simulation/rogue/queries";
import {
    RogueContentService,
} from "../../examples/flying-sword/src/simulation/rogue/content-service";
import {
    EnemyCatalog,
    EnemyKind,
} from "../../examples/flying-sword/src/content/enemies";
import {
    resolveEnemyMovementSpeedSystem,
} from "../../examples/flying-sword/src/simulation/rogue/enemy/movement-speed-system";
import {
    STONE_GOLEM_CHARGE_DURATION_TICKS,
    STONE_GOLEM_CHARGE_RECOVERY_TICKS,
    STONE_GOLEM_CHARGE_SPEED,
    STONE_GOLEM_CHARGE_WINDUP_TICKS,
    shouldStartStoneGolemCharge,
    updateStoneGolemChargeSystem,
} from "../../examples/flying-sword/src/simulation/rogue/enemy/stone-golem-charge-system";
import {
    CultivatorTag,
} from "../../examples/flying-sword/src/simulation/components";
import {
    resolveEnemyCombatSystem,
} from "../../examples/flying-sword/src/simulation/rogue/enemy/combat-system";
import {
    applyEnemyEmpowermentModifiersSystem,
    isWithinSwordWraithEmpowerment,
    pulseSwordWraithEmpowermentSystem,
} from "../../examples/flying-sword/src/simulation/rogue/enemy/sword-wraith-empowerment-system";
import {
    cleanupHealingFactsSystem,
    calculateResolvedHealing,
    resolveHealingRequestsSystem,
    type ResolvedHealingOut,
} from "../../examples/flying-sword/src/simulation/rogue/recovery-system";

type TestDamageRequests = QueryOf<typeof RogueDamageRequestQuery>;
type TestRunPhases = QueryOf<typeof RogueRunPhaseQuery>;

const TestEmpoweredEnemyQuery = QueryType.from(With(
    Position3Type,
    MoveTowards3Type,
    EnemyCombatType,
    EnemyEmpowermentType,
));

const HealingTargetQuery = QueryType.from(With(HealthType));
const HealingRequestTestQuery = QueryType.from(With(HealingRequestType));

const setupHealingPipelineTestSystem = defSystem(
    Startup,
    (commands: Commands): void => {
        const targetCommand = commands.spawn();
        const target = targetCommand.entity;
        targetCommand
            .add(HealthType)
            .set(HealthType, Health.Current, 50)
            .set(HealthType, Health.Maximum, 100)
            .submit();
        for (const amount of [30, 40]) {
            commands
                .spawn()
                .add(HealingRequestType)
                .set(
                    HealingRequestType,
                    HealingRequest.Source,
                    target,
                )
                .set(
                    HealingRequestType,
                    HealingRequest.Target,
                    target,
                )
                .set(
                    HealingRequestType,
                    HealingRequest.Amount,
                    amount,
                )
                .set(
                    HealingRequestType,
                    HealingRequest.Kind,
                    HealingKind.Skill,
                )
                .submit();
        }
    },
    [Commands],
);

const setupLightningChainTestSystem = defSystem(
    Startup,
    (
        commands: Commands,
        scratch: Mut<CombatScratchState>,
        index: Mut<EnemySpatialIndexState>,
    ): void => {
        const groupCommand = commands.spawn();
        const group = groupCommand.entity;
        groupCommand.submit();
        const sourceCommand = commands.spawn();
        const source = sourceCommand.entity;
        sourceCommand.submit();
        const primaryCommand = commands.spawn();
        const primary = primaryCommand.entity;
        primaryCommand
            .add(Position3Type)
            .add(EnemyBodyType)
            .set(Position3Type, Float3.X, 0)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, 0)
            .set(EnemyBodyType, EnemyBody.Radius, 0.5)
            .set(EnemyBodyType, EnemyBody.CenterHeight, 0.8)
            .submit();
        const chainedCommand = commands.spawn();
        const chained = chainedCommand.entity;
        chainedCommand
            .add(Position3Type)
            .add(EnemyBodyType)
            .set(Position3Type, Float3.X, 2)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, 0)
            .set(EnemyBodyType, EnemyBody.Radius, 0.5)
            .set(EnemyBodyType, EnemyBody.CenterHeight, 0.8)
            .submit();
        commands
            .spawn()
            .add(DamageRequestType)
            .add(FlyingSwordDamageSourceType)
            .set(DamageRequestType, DamageRequest.Source, source)
            .set(DamageRequestType, DamageRequest.Target, primary)
            .set(DamageRequestType, DamageRequest.Amount, 20)
            .set(
                DamageRequestType,
                DamageRequest.Kind,
                DamageKind.ScatterSword,
            )
            .set(
                FlyingSwordDamageSourceType,
                FlyingSwordDamageSource.Group,
                group,
            )
            .submit();
        scratch.groupLightningChainCounts.set(group, 1);
        scratch.groupLightningChainRadii.set(group, 6);
        scratch.groupLightningDamageMultipliers.set(group, 0.55);
        index.reset(0, 0);
        index.insert(primary, 0, 0.8, 0, 0.5);
        index.insert(chained, 2, 0.8, 0, 0.5);
    },
    [
        Commands,
        Write(CombatScratchState),
        Write(EnemySpatialIndexState),
    ],
);

const setupMetalBreakTestSystem = defSystem(
    Startup,
    (
        commands: Commands,
        scratch: Mut<CombatScratchState>,
    ): void => {
        const group = commands.spawn();
        group.submit();
        const source = commands.spawn();
        source.submit();
        const target = commands.spawn();
        target.submit();
        commands
            .spawn()
            .add(DamageRequestType)
            .add(FlyingSwordDamageSourceType)
            .add(PiercingDamageType)
            .set(DamageRequestType, DamageRequest.Source, source.entity)
            .set(DamageRequestType, DamageRequest.Target, target.entity)
            .set(DamageRequestType, DamageRequest.Amount, 20)
            .set(
                DamageRequestType,
                DamageRequest.Kind,
                DamageKind.FocusSword,
            )
            .set(
                FlyingSwordDamageSourceType,
                FlyingSwordDamageSource.Group,
                group.entity,
            )
            .set(PiercingDamageType, PiercingDamage.PriorHits, 3)
            .submit();
        scratch.groupMetalMaximumMomentum.set(group.entity, 4);
        scratch.groupMetalDamagePerMomentum.set(group.entity, 0.2);
    },
    [Commands, Write(CombatScratchState)],
);

const setupFireBurstTestSystem = defSystem(
    Startup,
    (
        commands: Commands,
        scratch: Mut<CombatScratchState>,
        index: Mut<EnemySpatialIndexState>,
    ): void => {
        const group = commands.spawn();
        group.submit();
        const source = commands.spawn();
        source.submit();
        const primary = commands.spawn();
        primary
            .add(Position3Type)
            .add(EnemyFireAccumulationType)
            .set(Position3Type, Float3.X, 0)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, 0)
            .set(
                EnemyFireAccumulationType,
                EnemyFireAccumulation.SourceGroup,
                group.entity,
            )
            .set(
                EnemyFireAccumulationType,
                EnemyFireAccumulation.Stacks,
                3,
            )
            .submit();
        const nearby = commands.spawn();
        nearby.submit();
        commands
            .spawn()
            .add(DamageRequestType)
            .add(FlyingSwordDamageSourceType)
            .set(DamageRequestType, DamageRequest.Source, source.entity)
            .set(DamageRequestType, DamageRequest.Target, primary.entity)
            .set(DamageRequestType, DamageRequest.Amount, 20)
            .set(
                DamageRequestType,
                DamageRequest.Kind,
                DamageKind.FocusSword,
            )
            .set(
                FlyingSwordDamageSourceType,
                FlyingSwordDamageSource.Group,
                group.entity,
            )
            .submit();
        scratch.groupFireBurstThresholds.set(group.entity, 4);
        scratch.groupFireBurstRadii.set(group.entity, 2.6);
        scratch.groupFireBurstDamageMultipliers.set(
            group.entity,
            0.85,
        );
        index.reset(0, 0);
        index.insert(primary.entity, 0, 0.8, 0, 0.5);
        index.insert(nearby.entity, 2, 0.8, 0, 0.5);
    },
    [
        Commands,
        Write(CombatScratchState),
        Write(EnemySpatialIndexState),
    ],
);

const setupColdSlowTestSystem = defSystem(
    Startup,
    (
        commands: Commands,
        scratch: Mut<CombatScratchState>,
    ): void => {
        const group = commands.spawn();
        group.submit();
        const source = commands.spawn();
        source.submit();
        const target = commands.spawn();
        target
            .add(EnemyLocomotionType)
            .add(MoveTowards3Type)
            .add(EnemyColdAccumulationType)
            .set(
                EnemyLocomotionType,
                EnemyLocomotion.BaseSpeed,
                10,
            )
            .set(
                EnemyLocomotionType,
                EnemyLocomotion.BaseAcceleration,
                10,
            )
            .set(
                EnemyLocomotionType,
                EnemyLocomotion.DesiredSpeed,
                10,
            )
            .set(
                EnemyLocomotionType,
                EnemyLocomotion.DesiredAcceleration,
                10,
            )
            .set(MoveTowards3Type, MoveTowards3.TargetX, 0)
            .set(MoveTowards3Type, MoveTowards3.TargetY, 0)
            .set(MoveTowards3Type, MoveTowards3.TargetZ, 0)
            .set(MoveTowards3Type, MoveTowards3.MaximumSpeed, 10)
            .set(MoveTowards3Type, MoveTowards3.Acceleration, 10)
            .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0)
            .set(
                EnemyColdAccumulationType,
                EnemyColdAccumulation.SourceGroup,
                0,
            )
            .set(
                EnemyColdAccumulationType,
                EnemyColdAccumulation.Stacks,
                0,
            )
            .set(
                EnemyColdAccumulationType,
                EnemyColdAccumulation.ExpireTick,
                0,
            )
            .submit();
        commands
            .spawn()
            .add(DamageRequestType)
            .add(FlyingSwordDamageSourceType)
            .set(DamageRequestType, DamageRequest.Source, source.entity)
            .set(DamageRequestType, DamageRequest.Target, target.entity)
            .set(DamageRequestType, DamageRequest.Amount, 10)
            .set(
                DamageRequestType,
                DamageRequest.Kind,
                DamageKind.ScatterSword,
            )
            .set(
                FlyingSwordDamageSourceType,
                FlyingSwordDamageSource.Group,
                group.entity,
            )
            .submit();
        scratch.groupColdMaximumStacks.set(group.entity, 5);
        scratch.groupColdSlowPerStack.set(group.entity, 0.08);
        scratch.groupColdDurationTicks.set(group.entity, 180);
    },
    [Commands, Write(CombatScratchState)],
);

const cleanupColdTestDamageRequestsSystem = defSystem(
    Update.fixed,
    (
        commands: Commands,
        requests: TestDamageRequests,
    ): void => {
        const iter = requests.iter();
        while (iter.next()) {
            const [count, entities] = iter.current;
            for (let row = 0; row < count; row++) {
                commands.entity(entities[row]).despawn().submit();
            }
        }
    },
    [Commands, RogueDamageRequestQuery],
);

const setupEnemyAbilityCompositionTestSystem = defSystem(
    Startup,
    (content: RogueContentService): void => {
        content.spawnEnemy(
            EnemyKind.CorruptedBat,
            -2,
            0,
            0,
            0,
            1,
        );
        content.spawnEnemy(
            EnemyKind.StoneGolem,
            2,
            0,
            0,
            0,
            1,
        );
        content.spawnEnemy(
            EnemyKind.SwordWraith,
            4,
            0,
            0,
            0,
            1,
        );
    },
    [RogueContentService],
);

const setupStoneGolemChargeLifecycleTestSystem = defSystem(
    Startup,
    (commands: Commands): void => {
        commands
            .spawn()
            .add(RogueRunClockType)
            .add(RogueRunStatusType)
            .set(RogueRunClockType, RogueRunClock.Tick, 0)
            .set(
                RogueRunStatusType,
                RogueRunStatus.Phase,
                RogueRunPhase.Playing,
            )
            .submit();
        commands
            .spawn()
            .add(Position3Type)
            .add(CultivatorTag)
            .set(Position3Type, Float3.X, 5)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, 0)
            .submit();
        commands
            .spawn()
            .add(Position3Type)
            .add(Velocity3Type)
            .add(MoveTowards3Type)
            .add(EnemyLocomotionType)
            .add(StoneGolemChargeType)
            .set(Position3Type, Float3.X, 0)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, 0)
            .set(Velocity3Type, Float3.X, 0)
            .set(Velocity3Type, Float3.Y, 0)
            .set(Velocity3Type, Float3.Z, 0)
            .set(MoveTowards3Type, MoveTowards3.TargetX, 5)
            .set(MoveTowards3Type, MoveTowards3.TargetY, 0)
            .set(MoveTowards3Type, MoveTowards3.TargetZ, 0)
            .set(MoveTowards3Type, MoveTowards3.MaximumSpeed, 1.35)
            .set(MoveTowards3Type, MoveTowards3.Acceleration, 13)
            .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0)
            .set(
                EnemyLocomotionType,
                EnemyLocomotion.BaseSpeed,
                1.35,
            )
            .set(
                EnemyLocomotionType,
                EnemyLocomotion.BaseAcceleration,
                13,
            )
            .set(
                EnemyLocomotionType,
                EnemyLocomotion.DesiredSpeed,
                1.35,
            )
            .set(
                EnemyLocomotionType,
                EnemyLocomotion.DesiredAcceleration,
                13,
            )
            .set(
                StoneGolemChargeType,
                StoneGolemCharge.Phase,
                StoneGolemChargePhase.Pursuit,
            )
            .set(
                StoneGolemChargeType,
                StoneGolemCharge.PhaseStartTick,
                0,
            )
            .set(
                StoneGolemChargeType,
                StoneGolemCharge.NextChargeTick,
                0,
            )
            .set(
                StoneGolemChargeType,
                StoneGolemCharge.DirectionX,
                0,
            )
            .set(
                StoneGolemChargeType,
                StoneGolemCharge.DirectionZ,
                1,
            )
            .submit();
    },
    [Commands],
);

const advanceStoneGolemChargeTestClockSystem = defSystem(
    Update.fixed,
    (runs: TestRunPhases): void => {
        const iter = runs.iter();
        while (iter.next()) {
            const [count, , clocks] = iter.current;
            const ticks = clocks[RogueRunClock.Tick];
            for (let row = 0; row < count; row++) ticks[row]++;
        }
    },
    [RogueRunPhaseQuery],
);

const setupSwordWraithEmpowermentTestSystem = defSystem(
    Startup,
    (commands: Commands): void => {
        commands
            .spawn()
            .add(RogueRunClockType)
            .add(RogueRunStatusType)
            .set(RogueRunClockType, RogueRunClock.Tick, 0)
            .set(
                RogueRunStatusType,
                RogueRunStatus.Phase,
                RogueRunPhase.Playing,
            )
            .submit();
        commands
            .spawn()
            .add(Position3Type)
            .add(HealthType)
            .add(EnemyEmpowermentType)
            .add(SwordWraithEmpowermentType)
            .set(Position3Type, Float3.X, 0)
            .set(Position3Type, Float3.Y, 0)
            .set(Position3Type, Float3.Z, 0)
            .set(HealthType, Health.Current, 100)
            .set(HealthType, Health.Maximum, 100)
            .set(
                EnemyEmpowermentType,
                EnemyEmpowerment.Source,
                0,
            )
            .set(
                EnemyEmpowermentType,
                EnemyEmpowerment.ExpireTick,
                0,
            )
            .set(
                EnemyEmpowermentType,
                EnemyEmpowerment.SpeedMultiplier,
                1,
            )
            .set(
                EnemyEmpowermentType,
                EnemyEmpowerment.ContactDamageMultiplier,
                1,
            )
            .set(
                SwordWraithEmpowermentType,
                SwordWraithEmpowerment.Radius,
                5,
            )
            .set(
                SwordWraithEmpowermentType,
                SwordWraithEmpowerment.IntervalTicks,
                1000,
            )
            .set(
                SwordWraithEmpowermentType,
                SwordWraithEmpowerment.DurationTicks,
                3,
            )
            .set(
                SwordWraithEmpowermentType,
                SwordWraithEmpowerment.NextPulseTick,
                0,
            )
            .set(
                SwordWraithEmpowermentType,
                SwordWraithEmpowerment.SpeedMultiplier,
                1.25,
            )
            .set(
                SwordWraithEmpowermentType,
                SwordWraithEmpowerment.ContactDamageMultiplier,
                1.5,
            )
            .set(
                SwordWraithEmpowermentType,
                SwordWraithEmpowerment.PulseEndTick,
                0,
            )
            .submit();
        spawnEmpowermentTestTarget(commands, 3);
        spawnEmpowermentTestTarget(commands, 8);
    },
    [Commands],
);

function spawnEmpowermentTestTarget(
    commands: Commands,
    x: number,
): void {
    commands
        .spawn()
        .add(Position3Type)
        .add(HealthType)
        .add(MoveTowards3Type)
        .add(EnemyLocomotionType)
        .add(EnemyCombatType)
        .add(EnemyEmpowermentType)
        .set(Position3Type, Float3.X, x)
        .set(Position3Type, Float3.Y, 0)
        .set(Position3Type, Float3.Z, 0)
        .set(HealthType, Health.Current, 100)
        .set(HealthType, Health.Maximum, 100)
        .set(MoveTowards3Type, MoveTowards3.TargetX, 0)
        .set(MoveTowards3Type, MoveTowards3.TargetY, 0)
        .set(MoveTowards3Type, MoveTowards3.TargetZ, 0)
        .set(MoveTowards3Type, MoveTowards3.MaximumSpeed, 10)
        .set(MoveTowards3Type, MoveTowards3.Acceleration, 20)
        .set(MoveTowards3Type, MoveTowards3.ArrivalRadius, 0)
        .set(
            EnemyLocomotionType,
            EnemyLocomotion.BaseSpeed,
            10,
        )
        .set(
            EnemyLocomotionType,
            EnemyLocomotion.BaseAcceleration,
            20,
        )
        .set(
            EnemyLocomotionType,
            EnemyLocomotion.DesiredSpeed,
            10,
        )
        .set(
            EnemyLocomotionType,
            EnemyLocomotion.DesiredAcceleration,
            20,
        )
        .set(
            EnemyCombatType,
            EnemyCombat.BaseContactDamage,
            20,
        )
        .set(
            EnemyCombatType,
            EnemyCombat.ContactDamage,
            20,
        )
        .set(EnemyCombatType, EnemyCombat.NextContactTick, 0)
        .set(
            EnemyEmpowermentType,
            EnemyEmpowerment.Source,
            0,
        )
        .set(
            EnemyEmpowermentType,
            EnemyEmpowerment.ExpireTick,
            0,
        )
        .set(
            EnemyEmpowermentType,
            EnemyEmpowerment.SpeedMultiplier,
            1,
        )
        .set(
            EnemyEmpowermentType,
            EnemyEmpowerment.ContactDamageMultiplier,
            1,
        )
        .submit();
}

test("rogue random sequence is deterministic and never remains zero", () => {
    let left = 0;
    let right = 0;
    for (let index = 0; index < 8; index++) {
        left = nextRogueRandom(left);
        right = nextRogueRandom(right);
        expect(left).toBe(right);
        expect(left).not.toBe(0);
    }
});

test("experience requirement rises with level", () => {
    expect(rogueRequiredExperienceFor(1)).toBe(13);
    expect(rogueRequiredExperienceFor(2)).toBeGreaterThan(
        rogueRequiredExperienceFor(1),
    );
    expect(rogueRequiredExperienceFor(20)).toBeGreaterThan(
        rogueRequiredExperienceFor(10),
    );
});

test("upgrade catalog covers every combat route without missing metadata", () => {
    const catalog = new RogueUpgradeCatalog();
    expect(catalog.count).toBe(
        RogueUpgrade.StrengthenSpiritualSense + 1,
    );
    expect(catalog.names).toHaveLength(catalog.count);
    expect(catalog.descriptions).toHaveLength(catalog.count);
    expect(catalog.names[RogueUpgrade.FocusPower]).toContain("归一");
    expect(catalog.names[RogueUpgrade.ScatterRange]).toContain("分光");
    expect(catalog.names[RogueUpgrade.FormationPower]).toContain("周天");
    expect(catalog.names[RogueUpgrade.FusionPower]).toContain("合一");
    expect(
        catalog.descriptions[RogueUpgrade.FusionEfficiency],
    ).toContain("消耗降低");
    expect(
        catalog.descriptions[RogueUpgrade.FusionEndurance],
    ).toContain("最大体力增加");
    expect(catalog.names[RogueUpgrade.FormationRange])
        .toContain("广域");
    expect(catalog.descriptions[RogueUpgrade.FormationTempo])
        .toContain("运行速度提高");
    expect(catalog.names[RogueUpgrade.LightningIntent])
        .toContain("雷意");
    expect(catalog.names[RogueUpgrade.MetalIntent])
        .toContain("金意");
    expect(catalog.names[RogueUpgrade.FireIntent])
        .toContain("火意");
    expect(catalog.names[RogueUpgrade.ColdIntent])
        .toContain("寒意");
});

test("sword blueprint catalog gives every template a distinct role", () => {
    const catalog = new SwordBlueprintCatalog();
    expect(catalog.count).toBe(SwordBlueprint.Burst + 1);
    expect(catalog.names).toHaveLength(catalog.count);
    expect(catalog.isValid(-1)).toBe(false);
    expect(catalog.isValid(catalog.count)).toBe(false);
    expect(catalog.isValid(1.5)).toBe(false);
    expect(
        catalog.minimumDamage[SwordBlueprint.Heavy],
    ).toBeGreaterThan(catalog.minimumDamage[SwordBlueprint.Light]);
    expect(
        catalog.attackIntervalTicks[SwordBlueprint.Light],
    ).toBeLessThan(
        catalog.attackIntervalTicks[SwordBlueprint.Heavy],
    );
    expect(
        catalog.maximumSpiritPower[SwordBlueprint.Spirit],
    ).toBeGreaterThan(
        catalog.maximumSpiritPower[SwordBlueprint.Burst],
    );
    expect(
        catalog.formationSpiritDrainPerSecond[SwordBlueprint.Spirit],
    ).toBeLessThan(
        catalog.formationSpiritDrainPerSecond[SwordBlueprint.Burst],
    );
});

test("sword offers are deterministic and stay inside the catalog", () => {
    const catalog = new SwordBlueprintCatalog();
    const left = createSwordOfferRollOut();
    const right = createSwordOfferRollOut();
    const leftState = rollSwordOfferValues(12345, catalog, left);
    const rightState = rollSwordOfferValues(12345, catalog, right);
    expect(leftState).toBe(rightState);
    expect(left).toEqual(right);
    expect(catalog.isValid(left.blueprint)).toBe(true);
    expect(left.recommendation).toBe(
        catalog.recommendations[left.blueprint],
    );
    expect(left.maximumDamage).toBeGreaterThan(left.minimumDamage);
    expect(left.attackIntervalTicks).toBeGreaterThanOrEqual(12);
    expect(left.scatterSpiritCost).toBeGreaterThan(0);
    expect(left.focusSpiritCost).toBeGreaterThan(
        left.scatterSpiritCost,
    );

    const seen = new Set<number>();
    for (let seed = 1; seed <= 64; seed++) {
        rollSwordOfferValues(seed, catalog, left);
        seen.add(left.blueprint);
    }
    expect(seen.size).toBe(catalog.count);
});

test("full sword containers enter a persistent replacement transaction", () => {
    expect(swordContainerNeedsReplacement(11, 12)).toBe(false);
    expect(swordContainerNeedsReplacement(12, 12)).toBe(true);
    expect(swordContainerNeedsReplacement(49, 64)).toBe(true);

    const selection = new SwordReplacementSelectionType();
    expect(
        selection[SwordReplacementSelection.Offer],
    ).toBeDefined();
    expect(
        selection[SwordReplacementSelection.Container],
    ).toBeDefined();

    const request = new ReplaceSwordRequestType();
    expect(request[ReplaceSwordRequest.Offer]).toBeDefined();
    expect(request[ReplaceSwordRequest.Outgoing]).toBeDefined();

    const pending = new PendingSwordReplacementType();
    expect(pending[PendingSwordReplacement.Offer]).toBeDefined();
    expect(pending[PendingSwordReplacement.Outgoing]).toBeDefined();
    expect(pending[PendingSwordReplacement.Container]).toBeDefined();
    expect(
        pending[PendingSwordReplacement.InventorySlot],
    ).toBeDefined();
});

test("healing resolution clamps actual recovery and records overflow", () => {
    const out: ResolvedHealingOut = { applied: 0, overflow: 0 };
    calculateResolvedHealing(40, 100, 25, out);
    expect(out).toEqual({ applied: 25, overflow: 0 });
    calculateResolvedHealing(90, 100, 25, out);
    expect(out).toEqual({ applied: 10, overflow: 15 });
    calculateResolvedHealing(100, 100, 25, out);
    expect(out).toEqual({ applied: 0, overflow: 25 });
    calculateResolvedHealing(0, 100, 25, out);
    expect(out).toEqual({ applied: 0, overflow: 25 });
    calculateResolvedHealing(40, 100, -10, out);
    expect(out).toEqual({ applied: 0, overflow: 0 });
    calculateResolvedHealing(40, 100, Number.NaN, out);
    expect(out).toEqual({ applied: 0, overflow: 0 });
});

test("healing pipeline deterministically combines same-tick requests", () => {
    const builder = new GameBuilder().addModule(new CommandModule());
    builder.addState(RogueEntityAccessState);
    builder.addSystem(setupHealingPipelineTestSystem);
    builder.addSystem(resolveHealingRequestsSystem);
    builder.addSystem(cleanupHealingFactsSystem, {
        after: resolveHealingRequestsSystem,
    });
    const game = builder.build();
    game.init();
    game.start();
    game.update();
    game.update();
    game.update();

    const targetIter = game.world.query(HealingTargetQuery).iter();
    expect(targetIter.next()).toBe(true);
    const [, , health] = targetIter.current;
    expect(health[Health.Current][0]).toBe(100);

    const requestIter =
        game.world.query(HealingRequestTestQuery).iter();
    expect(requestIter.next()).toBe(false);
    game.dispose();
});

test("fusion starts with a meaningful stamina drain budget", () => {
    const tuning = new RogueRunTuning("");
    expect(tuning.initialStamina).toBe(100);
    expect(tuning.fusionStaminaDrainPerSecond).toBe(40);
    expect(
        tuning.initialStamina /
        tuning.fusionStaminaDrainPerSecond,
    ).toBeCloseTo(2.5);
    expect(tuning.initialFormationRadius).toBeGreaterThan(3.15);
    expect(tuning.initialFormationAngularSpeed).toBeGreaterThan(0.72);
});

test("swept sword contact measures the whole segment", () => {
    expect(
        squaredDistanceToSegment3(
            5, 0, 0,
            0, 0, 0,
            10, 0, 0,
        ),
    ).toBe(0);
    expect(
        squaredDistanceToSegment3(
            5, 2, 0,
            0, 0, 0,
            10, 0, 0,
        ),
    ).toBe(4);
    expect(
        squaredDistanceToSegment3(
            12, 0, 0,
            0, 0, 0,
            10, 0, 0,
        ),
    ).toBe(4);
    expect(
        progressAlongSegment3(
            2.5, 0, 0,
            0, 0, 0,
            10, 0, 0,
        ),
    ).toBeCloseTo(0.25);
    expect(
        progressAlongSegment3(
            12, 0, 0,
            0, 0, 0,
            10, 0, 0,
        ),
    ).toBe(1);
});

test("focus piercing activates only below its height threshold", () => {
    expect(focusPiercingSegmentStartRatio(3, 2, 1.65)).toBe(-1);
    expect(focusPiercingSegmentStartRatio(1.5, 1.2, 1.65)).toBe(0);
    expect(
        focusPiercingSegmentStartRatio(2.4, 1.4, 1.65),
    ).toBeCloseTo(0.75);
});

test("focus target distance stays inside the effective cast ring", () => {
    const out = { x: 0, z: 0 };
    clampFocusTargetDistance(0, 0, 1, 0, 0, 1, 5, 14, out);
    expect(out.x).toBeCloseTo(5);
    expect(out.z).toBeCloseTo(0);

    clampFocusTargetDistance(0, 0, 30, 0, 0, 1, 5, 14, out);
    expect(out.x).toBeCloseTo(14);
    expect(out.z).toBeCloseTo(0);

    clampFocusTargetDistance(2, 3, 2, 3, 0, -1, 5, 14, out);
    expect(out.x).toBeCloseTo(2);
    expect(out.z).toBeCloseTo(-2);
});

test("focus consumes a cast snapshot whose damage scales with mana spent", () => {
    expect(focusManaDamageMultiplier(0, 100)).toBe(1);
    expect(focusManaDamageMultiplier(25, 100)).toBeCloseTo(1.25);
    expect(focusManaDamageMultiplier(100, 100)).toBeCloseTo(2);
    expect(focusManaDamageMultiplier(100, 0)).toBe(1);
});

test("focus piercing records every sword once per enemy and action", () => {
    const actions = new Uint32Array(2);
    const lowMasks = new Uint32Array(2);
    const highMasks = new Uint32Array(2);
    const firstAction = 0x1001 as Entity;
    const nextAction = 0x2001 as Entity;

    expect(
        recordFocusSwordHit(
            actions,
            lowMasks,
            highMasks,
            0,
            firstAction,
            0,
        ),
    ).toBe(true);
    expect(
        recordFocusSwordHit(
            actions,
            lowMasks,
            highMasks,
            0,
            firstAction,
            0,
        ),
    ).toBe(false);
    expect(
        recordFocusSwordHit(
            actions,
            lowMasks,
            highMasks,
            0,
            firstAction,
            48,
        ),
    ).toBe(true);
    expect(highMasks[0]).not.toBe(0);
    expect(
        recordFocusSwordHit(
            actions,
            lowMasks,
            highMasks,
            1,
            firstAction,
            0,
        ),
    ).toBe(true);
    expect(
        recordFocusSwordHit(
            actions,
            lowMasks,
            highMasks,
            0,
            nextAction,
            0,
        ),
    ).toBe(true);
    expect(actions[0]).toBe(nextAction);
    expect(highMasks[0]).toBe(0);
});

test("piercing candidates are ordered by progress then entity", () => {
    const candidates = new FocusPiercingCandidateState();
    const entities = new Uint32Array([30, 10, 20]);
    candidates.insert(0, 0.8);
    candidates.insert(2, 0.2);
    candidates.insert(1, 0.2);
    candidates.sort(entities);

    expect(Array.from(
        candidates.indices.subarray(0, candidates.count),
    )).toEqual([1, 2, 0]);
    const storage = candidates.indices;
    candidates.reset();
    expect(candidates.count).toBe(0);
    expect(candidates.indices).toBe(storage);
});

test("lightning intent chains to the closest different enemy", () => {
    const index = new EnemySpatialIndexState();
    const primary = 0x1001 as Entity;
    const closest = 0x2001 as Entity;
    const farther = 0x3001 as Entity;
    index.reset(0, 0);
    index.insert(primary, 0, 0.8, 0, 0.5);
    index.insert(closest, 2, 0.8, 0, 0.5);
    index.insert(farther, 4, 0.8, 0, 0.5);

    const candidate = findClosestLightningChainCandidate(
        index,
        primary,
        0,
        0.8,
        0,
        6,
    );
    expect(candidate).toBeGreaterThanOrEqual(0);
    expect(index.entities[candidate]).toBe(closest);
    expect(
        findClosestLightningChainCandidate(
            index,
            primary,
            0,
            0.8,
            0,
            1,
        ),
    ).toBe(-1);
});

test("lightning intent only reacts to scatter and focus damage", () => {
    expect(canTriggerLightningChain(DamageKind.ScatterSword)).toBe(true);
    expect(canTriggerLightningChain(DamageKind.FocusSword)).toBe(true);
    expect(canTriggerLightningChain(DamageKind.FormationSword))
        .toBe(false);
    expect(canTriggerLightningChain(DamageKind.LightningChain))
        .toBe(false);
    expect(lightningChainDamage(20, 0.55)).toBeCloseTo(11);
    expect(lightningChainDamage(-20, 0.55)).toBe(0);
});

test("lightning intent system emits one chained damage and arc fact", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addResource(EnemyCatalog, new EnemyCatalog())
        .addState(CombatScratchState)
        .addState(EnemySpatialIndexState)
        .addState(LightningChainAccessState)
        .addService(RogueContentService);
    builder.addSystem(setupLightningChainTestSystem);
    builder.addSystem(chainLightningDamageSystem);
    const game = builder.build();
    game.init();
    game.start();
    game.update();
    game.update();

    let lightningRequests = 0;
    const requestIter =
        game.world.query(RogueDamageRequestQuery).iter();
    while (requestIter.next()) {
        const [count, , data] = requestIter.current;
        const amounts = data[DamageRequest.Amount];
        const kinds = data[DamageRequest.Kind];
        for (let row = 0; row < count; row++) {
            if (kinds[row] !== DamageKind.LightningChain) continue;
            lightningRequests++;
            expect(amounts[row]).toBeCloseTo(11);
        }
    }
    expect(lightningRequests).toBe(1);

    let arcCount = 0;
    const arcIter = game.world.query(RogueLightningArcQuery).iter();
    while (arcIter.next()) arcCount += arcIter.current[0];
    expect(arcCount).toBe(1);
    game.dispose();
});

test("metal intent only rewards later hits on one piercing line", () => {
    expect(canTriggerMetalBreak(DamageKind.FocusSword)).toBe(true);
    expect(canTriggerMetalBreak(DamageKind.SwordBodyUnity)).toBe(true);
    expect(canTriggerMetalBreak(DamageKind.ScatterSword)).toBe(false);
    expect(canTriggerMetalBreak(DamageKind.MetalBreak)).toBe(false);
    expect(metalBreakDamage(20, 0, 4, 0.2)).toBe(0);
    expect(metalBreakDamage(20, 2, 4, 0.2)).toBeCloseTo(8);
    expect(metalBreakDamage(20, 7, 4, 0.2)).toBeCloseTo(16);
    expect(metalBreakDamage(-20, 2, 4, 0.2)).toBe(0);
});

test("metal intent emits one capped breakthrough damage fact", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addResource(EnemyCatalog, new EnemyCatalog())
        .addState(CombatScratchState)
        .addService(RogueContentService);
    builder.addSystem(setupMetalBreakTestSystem);
    builder.addSystem(applyMetalBreakSystem);
    const game = builder.build();
    game.init();
    game.start();
    game.update();
    game.update();

    let metalRequests = 0;
    const requestIter =
        game.world.query(RogueDamageRequestQuery).iter();
    while (requestIter.next()) {
        const [count, , data] = requestIter.current;
        const amounts = data[DamageRequest.Amount];
        const kinds = data[DamageRequest.Kind];
        for (let row = 0; row < count; row++) {
            if (kinds[row] !== DamageKind.MetalBreak) continue;
            metalRequests++;
            expect(amounts[row]).toBeCloseTo(12);
        }
    }
    expect(metalRequests).toBe(1);
    game.dispose();
});

test("fire intent accumulates only focus and formation hits", () => {
    expect(canTriggerFireBurst(DamageKind.FocusSword)).toBe(true);
    expect(canTriggerFireBurst(DamageKind.FormationSword)).toBe(true);
    expect(canTriggerFireBurst(DamageKind.ScatterSword)).toBe(false);
    expect(canTriggerFireBurst(DamageKind.FireBurst)).toBe(false);
    expect(fireBurstDamage(20, 0.85)).toBeCloseTo(17);
    expect(fireBurstDamage(-20, 0.85)).toBe(0);
});

test("fire intent consumes four marks into one area burst", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addResource(EnemyCatalog, new EnemyCatalog())
        .addState(CombatScratchState)
        .addState(EnemySpatialIndexState)
        .addState(FireSwordIntentAccessState)
        .addService(RogueContentService);
    builder.addSystem(setupFireBurstTestSystem);
    builder.addSystem(applyFireSwordIntentSystem);
    const game = builder.build();
    game.init();
    game.start();
    game.update();
    game.update();

    let burstRequests = 0;
    const requestIter =
        game.world.query(RogueDamageRequestQuery).iter();
    while (requestIter.next()) {
        const [count, , data] = requestIter.current;
        const amounts = data[DamageRequest.Amount];
        const kinds = data[DamageRequest.Kind];
        for (let row = 0; row < count; row++) {
            if (kinds[row] !== DamageKind.FireBurst) continue;
            burstRequests++;
            expect(amounts[row]).toBeCloseTo(17);
        }
    }
    expect(burstRequests).toBe(2);

    let effectCount = 0;
    const effectIter = game.world.query(RogueFireBurstQuery).iter();
    while (effectIter.next()) effectCount += effectIter.current[0];
    expect(effectCount).toBe(1);
    game.dispose();
});

test("cold intent only slows scatter and formation targets", () => {
    expect(canTriggerColdSlow(DamageKind.ScatterSword)).toBe(true);
    expect(canTriggerColdSlow(DamageKind.FormationSword)).toBe(true);
    expect(canTriggerColdSlow(DamageKind.FocusSword)).toBe(false);
    expect(coldSpeedMultiplier(0, 0.08)).toBe(1);
    expect(coldSpeedMultiplier(3, 0.08)).toBeCloseTo(0.76);
    expect(coldSpeedMultiplier(20, 0.08)).toBe(0.4);
});

test("cold intent modifies behavior-selected movement without compounding", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addModule(new TimeModule(new FixedTimeResource(1 / 60)))
        .addState(CombatScratchState)
        .addState(ColdSwordIntentAccessState);
    builder.addSystem(setupColdSlowTestSystem);
    builder.addSystem(resolveEnemyMovementSpeedSystem);
    builder.addSystem(applyColdMovementModifierSystem);
    builder.addSystem(applyColdSwordIntentSystem);
    builder.addSystem(cleanupColdTestDamageRequestsSystem);
    const game = builder.build();
    game.init();
    game.start();
    game.update();
    game.update();

    let coldEnemies = 0;
    const iter = game.world.query(RogueColdEnemyQuery).iter();
    while (iter.next()) {
        const [count, , , motions, accumulations] = iter.current;
        const maximumSpeeds = motions[MoveTowards3.MaximumSpeed];
        const stacks =
            accumulations[EnemyColdAccumulation.Stacks];
        for (let row = 0; row < count; row++) {
            coldEnemies++;
            expect(stacks[row]).toBe(1);
            expect(maximumSpeeds[row]).toBeCloseTo(9.2);
        }
    }
    expect(coldEnemies).toBe(1);

    for (let tick = 0; tick < 181; tick++) game.update();
    const expiredIter = game.world.query(RogueColdEnemyQuery).iter();
    expect(expiredIter.next()).toBe(true);
    const [, , , expiredMotions, expiredAccumulations] =
        expiredIter.current;
    expect(
        expiredAccumulations[EnemyColdAccumulation.Stacks][0],
    ).toBe(0);
    expect(expiredMotions[MoveTowards3.MaximumSpeed][0]).toBe(10);
    game.dispose();
});

test("enemy kinds receive only their composed ability components", () => {
    const builder = new GameBuilder()
        .addModule(new CommandModule())
        .addResource(EnemyCatalog, new EnemyCatalog())
        .addService(RogueContentService);
    builder.addSystem(setupEnemyAbilityCompositionTestSystem);
    const game = builder.build();
    game.init();
    game.start();
    game.update();
    game.update();

    let chargeCapabilities = 0;
    const iter = game.world.query(RogueStoneGolemChargeQuery).iter();
    while (iter.next()) chargeCapabilities += iter.current[0];
    expect(chargeCapabilities).toBe(1);

    let empowermentCapabilities = 0;
    const empowermentIter =
        game.world.query(RogueSwordWraithEmpowermentQuery).iter();
    while (empowermentIter.next()) {
        empowermentCapabilities += empowermentIter.current[0];
    }
    expect(empowermentCapabilities).toBe(1);
    game.dispose();
});

test("sword wraith pulse empowers only nearby allies then expires", () => {
    expect(
        isWithinSwordWraithEmpowerment(0, 0, 3, 4, 5),
    ).toBe(true);
    expect(
        isWithinSwordWraithEmpowerment(0, 0, 5.01, 0, 5),
    ).toBe(false);
    expect(
        isWithinSwordWraithEmpowerment(0, 0, 0, 0, -1),
    ).toBe(false);

    const builder = new GameBuilder().addModule(new CommandModule());
    builder.addSystem(setupSwordWraithEmpowermentTestSystem);
    builder.addSystem(advanceStoneGolemChargeTestClockSystem);
    builder.addSystem(pulseSwordWraithEmpowermentSystem);
    builder.addSystem(resolveEnemyMovementSpeedSystem);
    builder.addSystem(resolveEnemyCombatSystem);
    builder.addSystem(applyEnemyEmpowermentModifiersSystem);
    const game = builder.build();
    game.init();
    game.start();
    game.update();
    game.update();

    const sourceIter =
        game.world.query(RogueSwordWraithEmpowermentQuery).iter();
    expect(sourceIter.next()).toBe(true);
    const [, , , sourceAbilities] = sourceIter.current;
    expect(
        sourceAbilities[SwordWraithEmpowerment.NextPulseTick][0],
    ).toBe(1001);
    expect(
        sourceAbilities[SwordWraithEmpowerment.PulseEndTick][0],
    ).toBeGreaterThan(1);

    let checkedInside = false;
    let checkedOutside = false;
    let targetIter = game.world.query(TestEmpoweredEnemyQuery).iter();
    while (targetIter.next()) {
        const [
            count,
            ,
            positions,
            motions,
            combats,
            empowerments,
        ] = targetIter.current;
        const xs = positions[Float3.X];
        const speeds = motions[MoveTowards3.MaximumSpeed];
        const damages = combats[EnemyCombat.ContactDamage];
        const expireTicks =
            empowerments[EnemyEmpowerment.ExpireTick];
        for (let row = 0; row < count; row++) {
            if (xs[row] === 3) {
                checkedInside = true;
                expect(speeds[row]).toBeCloseTo(12.5);
                expect(damages[row]).toBeCloseTo(30);
                expect(expireTicks[row]).toBe(4);
            } else if (xs[row] === 8) {
                checkedOutside = true;
                expect(speeds[row]).toBeCloseTo(10);
                expect(damages[row]).toBeCloseTo(20);
                expect(expireTicks[row]).toBe(0);
            }
        }
    }
    expect(checkedInside).toBe(true);
    expect(checkedOutside).toBe(true);

    for (let tick = 0; tick < 3; tick++) game.update();
    targetIter = game.world.query(TestEmpoweredEnemyQuery).iter();
    while (targetIter.next()) {
        const [
            count,
            ,
            positions,
            motions,
            combats,
            empowerments,
        ] = targetIter.current;
        const xs = positions[Float3.X];
        for (let row = 0; row < count; row++) {
            if (xs[row] !== 3) continue;
            expect(motions[MoveTowards3.MaximumSpeed][row])
                .toBeCloseTo(10);
            expect(combats[EnemyCombat.ContactDamage][row])
                .toBeCloseTo(20);
            expect(empowerments[EnemyEmpowerment.ExpireTick][row])
                .toBe(0);
            expect(empowerments[EnemyEmpowerment.SpeedMultiplier][row])
                .toBe(1);
        }
    }
    game.dispose();
});

test("stone golem locks a charge line then recovers to pursuit", () => {
    expect(
        shouldStartStoneGolemCharge(0, 0, 5, 0, 10, 10),
    ).toBe(true);
    expect(
        shouldStartStoneGolemCharge(0, 0, 9, 0, 10, 10),
    ).toBe(false);
    expect(
        shouldStartStoneGolemCharge(0, 0, 5, 0, 9, 10),
    ).toBe(false);

    const builder = new GameBuilder().addModule(new CommandModule());
    builder.addSystem(setupStoneGolemChargeLifecycleTestSystem);
    builder.addSystem(advanceStoneGolemChargeTestClockSystem);
    builder.addSystem(updateStoneGolemChargeSystem);
    const game = builder.build();
    game.init();
    game.start();
    game.update();
    game.update();

    let iter = game.world.query(RogueStoneGolemChargeQuery).iter();
    expect(iter.next()).toBe(true);
    let [, , , , , locomotions, charges] = iter.current;
    expect(charges[StoneGolemCharge.Phase][0])
        .toBe(StoneGolemChargePhase.Windup);
    expect(locomotions[EnemyLocomotion.DesiredSpeed][0]).toBe(0);
    expect(charges[StoneGolemCharge.DirectionX][0]).toBeCloseTo(1);
    expect(charges[StoneGolemCharge.DirectionZ][0]).toBeCloseTo(0);

    for (
        let tick = 0;
        tick < STONE_GOLEM_CHARGE_WINDUP_TICKS;
        tick++
    ) {
        game.update();
    }
    iter = game.world.query(RogueStoneGolemChargeQuery).iter();
    expect(iter.next()).toBe(true);
    let [, , , velocities, motions] = iter.current;
    locomotions = iter.current[5];
    charges = iter.current[6];
    expect(charges[StoneGolemCharge.Phase][0])
        .toBe(StoneGolemChargePhase.Charging);
    expect(locomotions[EnemyLocomotion.DesiredSpeed][0])
        .toBe(STONE_GOLEM_CHARGE_SPEED);
    expect(velocities[Float3.X][0])
        .toBeCloseTo(STONE_GOLEM_CHARGE_SPEED);
    expect(motions[MoveTowards3.TargetX][0]).toBeGreaterThan(15);

    for (
        let tick = 0;
        tick < STONE_GOLEM_CHARGE_DURATION_TICKS;
        tick++
    ) {
        game.update();
    }
    iter = game.world.query(RogueStoneGolemChargeQuery).iter();
    expect(iter.next()).toBe(true);
    charges = iter.current[6];
    expect(charges[StoneGolemCharge.Phase][0])
        .toBe(StoneGolemChargePhase.Recovery);

    for (
        let tick = 0;
        tick < STONE_GOLEM_CHARGE_RECOVERY_TICKS;
        tick++
    ) {
        game.update();
    }
    iter = game.world.query(RogueStoneGolemChargeQuery).iter();
    expect(iter.next()).toBe(true);
    locomotions = iter.current[5];
    charges = iter.current[6];
    expect(charges[StoneGolemCharge.Phase][0])
        .toBe(StoneGolemChargePhase.Pursuit);
    expect(locomotions[EnemyLocomotion.DesiredSpeed][0])
        .toBeCloseTo(1.35);
    game.dispose();
});

test("enemy spatial grid reuses storage, links cells, and clips outside", () => {
    const grid = new EnemySpatialIndexState();
    grid.reset(0, 0);
    grid.insert(11, 0, 0.5, 0, 0.4);
    grid.insert(12, 0.25, 0.5, 0.25, 0.5);

    const centerCell = (
        Math.floor((0 - grid.originZ) / GRID_CELL_SIZE) * GRID_WIDTH +
        Math.floor((0 - grid.originX) / GRID_CELL_SIZE)
    );
    expect(grid.count).toBe(2);
    expect(grid.cellHeads[centerCell]).toBe(1);
    expect(grid.next[1]).toBe(0);
    expect(grid.entities[0]).toBe(11);
    expect(grid.entities[1]).toBe(12);

    grid.insert(
        13,
        GRID_HALF_EXTENT + GRID_CELL_SIZE,
        0,
        0,
        0.4,
    );
    expect(grid.count).toBe(2);

    const previousEntities = grid.entities;
    grid.reset(1, 1);
    expect(grid.count).toBe(0);
    expect(grid.entities).toBe(previousEntities);
});

test("scatter launch cadence is derived from group combat values", () => {
    const launched: number[] = [];
    for (let slot = 0; slot < 7; slot++) {
        if (shouldLaunchScatterSword(8, slot, 7, 3)) {
            launched.push(slot);
        }
    }
    expect(launched).toEqual([2]);
    expect(shouldLaunchScatterSword(8, 2, 5, 1)).toBe(true);
    expect(shouldLaunchScatterSword(8, 2, 7, 3)).toBe(true);
});

test("fusion steering clamps turning instead of snapping to the cursor", () => {
    const xs = new Float32Array([1]);
    const zs = new Float32Array([0]);
    expect(
        steerDirection2Towards(
            xs,
            zs,
            0,
            0,
            1,
            Math.PI / 6,
        ),
    ).toBe(true);
    expect(xs[0]).toBeCloseTo(Math.cos(Math.PI / 6), 5);
    expect(zs[0]).toBeCloseTo(Math.sin(Math.PI / 6), 5);

    steerDirection2Towards(xs, zs, 0, 0, 1, Math.PI);
    expect(xs[0]).toBeCloseTo(0, 5);
    expect(zs[0]).toBeCloseTo(1, 5);
});
