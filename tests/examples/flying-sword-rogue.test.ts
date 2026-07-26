import {
    expect,
    test,
} from "@rstest/core";
import {
    CommandModule,
    Commands,
    GameBuilder,
    Startup,
    Write,
    defSystem,
    type Entity,
    type Mut,
} from "@zero-ecs/game";
import {
    FixedTimeResource,
    TimeModule,
} from "@zero-ecs/game/time";
import {
    Float3,
    Position3Type,
} from "@zero-ecs/math/3d";
import {
    nextRogueRandom,
    progressAlongSegment3,
    rogueRequiredExperienceFor,
    squaredDistanceToSegment3,
} from "../../examples/flying-sword/src/simulation/rogue/systems";
import {
    EnemySpatialIndexState,
    GRID_CELL_SIZE,
    GRID_HALF_EXTENT,
    GRID_WIDTH,
    CombatScratchState,
    FireSwordIntentAccessState,
    FocusPiercingCandidateState,
    LightningChainAccessState,
} from "../../examples/flying-sword/src/simulation/rogue/state";
import {
    RogueUpgrade,
    RogueUpgradeCatalog,
} from "../../examples/flying-sword/src/content/upgrades";
import {
    RogueRunTuning,
} from "../../examples/flying-sword/src/content/run-tuning";
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
    EnemyFireAccumulation,
    EnemyFireAccumulationType,
    FlyingSwordDamageSource,
    FlyingSwordDamageSourceType,
    PiercingDamage,
    PiercingDamageType,
} from "../../examples/flying-sword/src/simulation/rogue/components";
import {
    RogueDamageRequestQuery,
    RogueFireBurstQuery,
    RogueLightningArcQuery,
} from "../../examples/flying-sword/src/simulation/rogue/queries";
import {
    RogueContentService,
} from "../../examples/flying-sword/src/simulation/rogue/content-service";
import {
    EnemyCatalog,
} from "../../examples/flying-sword/src/content/enemies";

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
            .set(EnemyBodyType, EnemyBody.MoveSpeed, 0)
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
            .set(EnemyBodyType, EnemyBody.MoveSpeed, 0)
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
    expect(catalog.count).toBe(RogueUpgrade.FireIntent + 1);
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
