import {
    Commands,
    INVALID_ENTITY,
    SystemSet,
    Update,
    World,
    Write,
    defSystem,
    type ComponentColumns,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    FlyingSwordAction,
    FlyingSwordActionQuery,
    FlyingSwordActiveFormation,
    FlyingSwordBehavior,
    FlyingSwordGroupQuery,
    FlyingSwordMember,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordStance,
    FlyingSwordSkillAction,
    FlyingSwordSkillActionQuery,
    FlyingSwordSkillPhase,
    FlyingSwordSkillProgress,
    FlyingSwordSkillService,
    FlyingSwordSkillTiming,
    FlyingSwordSystemSet,
    FlyingSwordTaskQuery,
} from "@zero-ecs/flying-sword";
import {
    Float3,
    Position3Type,
} from "@zero-ecs/math/3d";
import {
    MotionSystemSet,
    MoveTowards3,
} from "@zero-ecs/motion/3d";
import {
    FlyingSwordVisual,
    FlyingSwordVisualType,
} from "../../content/components";
import {
    EnemyCatalog,
    EnemyKind,
} from "../../content/enemies";
import { RogueRunTuning } from "../../content/run-tuning";
import {
    RogueUpgrade,
    RogueUpgradeCatalog,
} from "../../content/upgrades";
import { RogueRunControlService } from "../../app/run-control-service";
import { CultivatorMoveActiveTag } from "../components";
import {
    AutoFlyingSwordSkill,
    ChooseUpgradeRequest,
    DamageRequest,
    EnemyBody,
    EnemyBodyType,
    EnemyCombat,
    EnemyDirector,
    EnemyIdentity,
    ExperiencePickup,
    ExperienceReward,
    FlyingSwordCombat,
    FlyingSwordCombatType,
    FlyingSwordContactCooldown,
    FlyingSwordContactCooldownType,
    Health,
    HealthType,
    LevelExperience,
    PlayerPickup,
    PlayerMovement,
    RogueRunClock,
    RogueRunIdentity,
    RogueRunPhase,
    RogueRunRandom,
    RogueRunStatistics,
    RogueRunStatus,
    RogueRunTarget,
    SwordBodyUnity,
    SwordBodyUnityType,
    UpgradeSelection,
} from "./components";
import { RogueContentService } from "./content-service";
import {
    RogueAutoFlyingSwordGroupQuery,
    RogueChooseUpgradeRequestQuery,
    RogueDamageRequestQuery,
    RogueEnemyQuery,
    RogueExperiencePickupQuery,
    RogueFlyingSwordContactQuery,
    RogueFlyingSwordCombatQuery,
    RogueFlyingSwordTaskContactQuery,
    RoguePlayerQuery,
    RogueRunQuery,
} from "./queries";
import {
    CombatScratchState,
    EnemySpatialIndexState,
    FlyingSwordTargetingState,
    GRID_CELL_SIZE,
    GRID_HEIGHT,
    GRID_WIDTH,
    RogueEntityAccessState,
} from "./state";

type Runs = QueryOf<typeof RogueRunQuery>;
type Players = QueryOf<typeof RoguePlayerQuery>;
type Enemies = QueryOf<typeof RogueEnemyQuery>;
type Pickups = QueryOf<typeof RogueExperiencePickupQuery>;
type DamageRequests = QueryOf<typeof RogueDamageRequestQuery>;
type AutoGroups = QueryOf<typeof RogueAutoFlyingSwordGroupQuery>;
type SwordContacts = QueryOf<typeof RogueFlyingSwordContactQuery>;
type SkillActions = QueryOf<typeof FlyingSwordSkillActionQuery>;
type UpgradeRequests = QueryOf<typeof RogueChooseUpgradeRequestQuery>;
type FlyingSwords = QueryOf<typeof FlyingSwordQuery>;
type CombatSwords = QueryOf<typeof RogueFlyingSwordCombatQuery>;
type SwordTasks = QueryOf<typeof FlyingSwordTaskQuery>;
type SwordTaskContacts =
    QueryOf<typeof RogueFlyingSwordTaskContactQuery>;
type SwordGroups = QueryOf<typeof FlyingSwordGroupQuery>;
type SwordActions = QueryOf<typeof FlyingSwordActionQuery>;

export const RogueSystemSet = Object.freeze({
    ApplyUpgrade: new SystemSet(
        Update.fixed,
        "flying-sword-rogue:apply-upgrade",
    ),
    Clock: new SystemSet(Update.fixed, "flying-sword-rogue:clock"),
    Spawn: new SystemSet(Update.fixed, "flying-sword-rogue:spawn"),
    Intent: new SystemSet(Update.fixed, "flying-sword-rogue:intent"),
    Targeting: new SystemSet(Update.fixed, "flying-sword-rogue:targeting"),
    Spatial: new SystemSet(Update.fixed, "flying-sword-rogue:spatial"),
    Contact: new SystemSet(Update.fixed, "flying-sword-rogue:contact"),
    Damage: new SystemSet(Update.fixed, "flying-sword-rogue:damage"),
    Death: new SystemSet(Update.fixed, "flying-sword-rogue:death"),
    Progression: new SystemSet(Update.fixed, "flying-sword-rogue:progression"),
    OpenUpgrade: new SystemSet(
        Update.fixed,
        "flying-sword-rogue:open-upgrade",
    ),
});

export const applyRogueUpgradeRequestsSystem = defSystem(
    Update.fixed,
    applyRogueUpgradeRequests,
    [
        Commands,
        FlyingSwordService,
        RogueRunQuery,
        RoguePlayerQuery,
        RogueAutoFlyingSwordGroupQuery,
        FlyingSwordQuery,
        RogueChooseUpgradeRequestQuery,
    ],
);

export const advanceRogueRunClockSystem = defSystem(
    Update.fixed,
    advanceRogueRunClock,
    [TimeState, RogueRunQuery],
);

export const directEnemySpawnsSystem = defSystem(
    Update.fixed,
    directEnemySpawns,
    [
        EnemyCatalog,
        RogueRunTuning,
        RogueContentService,
        RogueRunQuery,
        RoguePlayerQuery,
    ],
);

export const updateEnemyIntentSystem = defSystem(
    Update.fixed,
    updateEnemyIntent,
    [RogueRunQuery, RoguePlayerQuery, RogueEnemyQuery],
);

export const driveScatterFlyingSwordsSystem = defSystem(
    Update.fixed,
    driveScatterFlyingSwords,
    [
        FlyingSwordService,
        FlyingSwordSkillService,
        Write(CombatScratchState),
        Write(FlyingSwordTargetingState),
        RogueRunQuery,
        RoguePlayerQuery,
        RogueEnemyQuery,
        RogueAutoFlyingSwordGroupQuery,
        RogueFlyingSwordCombatQuery,
        FlyingSwordTaskQuery,
        FlyingSwordGroupQuery,
    ],
);

export const rebuildEnemySpatialIndexSystem = defSystem(
    Update.fixed,
    rebuildEnemySpatialIndex,
    [
        Write(EnemySpatialIndexState),
        RoguePlayerQuery,
        RogueEnemyQuery,
    ],
);

export const collideFlyingSwordsWithEnemiesSystem = defSystem(
    Update.fixed,
    collideFlyingSwordsWithEnemies,
    [
        Commands,
        World,
        Write(CombatScratchState),
        Write(EnemySpatialIndexState),
        RogueContentService,
        FlyingSwordService,
        TimeState,
        RogueAutoFlyingSwordGroupQuery,
        FlyingSwordSkillActionQuery,
        RogueFlyingSwordContactQuery,
        RogueFlyingSwordTaskContactQuery,
        RogueFlyingSwordCombatQuery,
        FlyingSwordTaskQuery,
        FlyingSwordActionQuery,
        FlyingSwordGroupQuery,
        RoguePlayerQuery,
    ],
);

export const collideEnemiesWithPlayerSystem = defSystem(
    Update.fixed,
    collideEnemiesWithPlayer,
    [
        RogueRunTuning,
        RogueContentService,
        RogueRunQuery,
        RoguePlayerQuery,
        RogueEnemyQuery,
    ],
);

export const resolveRogueDamageSystem = defSystem(
    Update.fixed,
    resolveRogueDamage,
    [
        Commands,
        World,
        Write(RogueEntityAccessState),
        RogueDamageRequestQuery,
    ],
);

export const reactToRogueDeathsSystem = defSystem(
    Update.fixed,
    reactToRogueDeaths,
    [
        Commands,
        RogueContentService,
        RogueRunQuery,
        RoguePlayerQuery,
        RogueEnemyQuery,
    ],
);

export const collectRogueExperienceSystem = defSystem(
    Update.fixed,
    collectRogueExperience,
    [
        TimeState,
        Commands,
        RogueRunQuery,
        RoguePlayerQuery,
        RogueExperiencePickupQuery,
    ],
);

export const openRogueUpgradeSelectionSystem = defSystem(
    Update.fixed,
    openRogueUpgradeSelection,
    [
        RogueUpgradeCatalog,
        RogueRunControlService,
        RogueRunQuery,
        RoguePlayerQuery,
        FlyingSwordQuery,
    ],
);

export const RogueSystemOptions = Object.freeze({
    applyUpgrade: {
        inSet: RogueSystemSet.ApplyUpgrade,
        before: RogueSystemSet.Clock,
    },
    clock: {
        inSet: RogueSystemSet.Clock,
        before: [
            RogueSystemSet.Spawn,
            RogueSystemSet.Intent,
            RogueSystemSet.Targeting,
        ],
    },
    spawn: {
        inSet: RogueSystemSet.Spawn,
        after: RogueSystemSet.Clock,
        before: MotionSystemSet.Integrate3,
    },
    intent: {
        inSet: RogueSystemSet.Intent,
        after: RogueSystemSet.Spawn,
        before: MotionSystemSet.Integrate3,
    },
    targeting: {
        inSet: RogueSystemSet.Targeting,
        after: RogueSystemSet.Clock,
        before: FlyingSwordSystemSet.Request,
    },
    spatial: {
        inSet: RogueSystemSet.Spatial,
        after: MotionSystemSet.Integrate3,
        before: RogueSystemSet.Contact,
    },
    swordContact: {
        inSet: RogueSystemSet.Contact,
        after: [
            RogueSystemSet.Spatial,
            FlyingSwordSystemSet.Contact,
        ],
        before: RogueSystemSet.Damage,
    },
    playerContact: {
        inSet: RogueSystemSet.Contact,
        after: RogueSystemSet.Spatial,
        before: RogueSystemSet.Damage,
    },
    damage: {
        inSet: RogueSystemSet.Damage,
        after: RogueSystemSet.Contact,
        before: RogueSystemSet.Death,
    },
    death: {
        inSet: RogueSystemSet.Death,
        after: RogueSystemSet.Damage,
        before: RogueSystemSet.Progression,
    },
    progression: {
        inSet: RogueSystemSet.Progression,
        after: RogueSystemSet.Death,
        before: RogueSystemSet.OpenUpgrade,
    },
    openUpgrade: {
        inSet: RogueSystemSet.OpenUpgrade,
        after: RogueSystemSet.Progression,
    },
});

function applyRogueUpgradeRequests(
    commands: Commands,
    flyingSwords: FlyingSwordService,
    runs: Runs,
    players: Players,
    groups: AutoGroups,
    swords: FlyingSwords,
    requests: UpgradeRequests,
): void {
    const requestIter = requests.iter();
    while (requestIter.next()) {
        const [count, entities, data] = requestIter.current;
        const slots = data[ChooseUpgradeRequest.Slot];
        for (let row = 0; row < count; row++) {
            const slot = slots[row];
            if (slot > 2) {
                commands.entity(entities[row]).despawn().submit();
                continue;
            }
            let upgrade = -1;
            let activeSelection: Uint8Array | undefined;
            const runIter = runs.iter();
            while (runIter.next()) {
                const [
                    runCount,
                    ,
                    ,
                    ,
                    ,
                    ,
                    ,
                    ,
                    ,
                    selection,
                ] = runIter.current;
                if (runCount === 0) continue;
                const active = selection[UpgradeSelection.Active];
                if (active[0] === 0) break;
                activeSelection = active;
                upgrade = slot === 0
                    ? selection[UpgradeSelection.OptionA][0]
                    : slot === 1
                        ? selection[UpgradeSelection.OptionB][0]
                        : selection[UpgradeSelection.OptionC][0];
                break;
            }
            if (upgrade >= 0 && activeSelection) {
                applyUpgradeToPlayer(upgrade, players);
                applyUpgradeToSwordGroup(upgrade, groups);
                if (upgrade === RogueUpgrade.AddSword) {
                    addFlyingSword(
                        commands,
                        flyingSwords,
                        runs,
                        players,
                        swords,
                    );
                }
                activeSelection[0] = 0;
                decrementPendingChoice(players);
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function addFlyingSword(
    commands: Commands,
    flyingSwords: FlyingSwordService,
    runs: Runs,
    players: Players,
    swords: FlyingSwords,
): void {
    let group = 0 as Entity;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [count, , identities] = runIter.current;
        if (count === 0) continue;
        group = identities[RogueRunIdentity.SwordGroup][0];
        break;
    }
    if (group === 0) return;

    let swordCount = 0;
    let maximumSlot = -1;
    const swordIter = swords.iter();
    while (swordIter.next()) {
        const [count, , members] = swordIter.current;
        const swordGroups = members[FlyingSwordMember.Group];
        const slots = members[FlyingSwordMember.Slot];
        for (let row = 0; row < count; row++) {
            if (swordGroups[row] !== group) continue;
            swordCount++;
            maximumSlot = Math.max(maximumSlot, slots[row]);
        }
    }
    if (swordCount >= MAX_FLYING_SWORD_UPGRADE_COUNT) return;

    let x = 0;
    let y = 0.9;
    let z = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , positions] = playerIter.current;
        if (count === 0) continue;
        x = positions[Float3.X][0];
        y = positions[Float3.Y][0] + 0.9;
        z = positions[Float3.Z][0];
        break;
    }
    const slot = maximumSlot + 1;
    const sword = flyingSwords.createSword({
        group,
        position: {
            x: x + ((slot & 1) === 0 ? -0.18 : 0.18),
            y,
            z: z - 0.55,
        },
        slot,
        maximumSpeed: 13,
        acceleration: 42,
    });
    commands
        .entity(sword)
        .add(FlyingSwordVisualType)
        .add(FlyingSwordCombatType)
        .set(
            FlyingSwordVisualType,
            FlyingSwordVisual.Id,
            slot,
        )
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
    flyingSwords.setFormationSize(group, swordCount + 1);
}

function openRogueUpgradeSelection(
    catalog: Readonly<RogueUpgradeCatalog>,
    control: RogueRunControlService,
    runs: Runs,
    players: Players,
    swords: FlyingSwords,
): void {
    let pendingChoices = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [
            count,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            levels,
        ] = playerIter.current;
        if (count === 0) continue;
        pendingChoices = levels[LevelExperience.PendingChoices][0];
        break;
    }
    if (pendingChoices === 0) return;

    const runIter = runs.iter();
    while (runIter.next()) {
        const [
            count,
            ,
            identities,
            ,
            statuses,
            randoms,
            ,
            ,
            ,
            selection,
        ] = runIter.current;
        if (
            count === 0 ||
            statuses[RogueRunStatus.Phase][0] !== RogueRunPhase.Playing ||
            selection[UpgradeSelection.Active][0] !== 0
        ) {
            continue;
        }
        const swordCount = countFlyingSwords(
            swords,
            identities[RogueRunIdentity.SwordGroup][0],
        );
        let randomState = randoms[RogueRunRandom.State][0];
        let first = 0;
        do {
            randomState = nextRogueRandom(randomState);
            first = randomState % catalog.count;
        } while (!isUpgradeAvailable(first, swordCount));
        let second = first;
        while (
            second === first ||
            !isUpgradeAvailable(second, swordCount)
        ) {
            randomState = nextRogueRandom(randomState);
            second = randomState % catalog.count;
        }
        let third = first;
        while (
            third === first ||
            third === second ||
            !isUpgradeAvailable(third, swordCount)
        ) {
            randomState = nextRogueRandom(randomState);
            third = randomState % catalog.count;
        }
        selection[UpgradeSelection.OptionA][0] = first;
        selection[UpgradeSelection.OptionB][0] = second;
        selection[UpgradeSelection.OptionC][0] = third;
        selection[UpgradeSelection.Active][0] = 1;
        randoms[RogueRunRandom.State][0] = randomState;
        control.pauseForUpgrade();
        return;
    }
}

function countFlyingSwords(
    swords: FlyingSwords,
    group: Entity,
): number {
    let result = 0;
    const iter = swords.iter();
    while (iter.next()) {
        const [count, , members] = iter.current;
        const groups = members[FlyingSwordMember.Group];
        for (let row = 0; row < count; row++) {
            if (groups[row] === group) result++;
        }
    }
    return result;
}

function isUpgradeAvailable(
    upgrade: number,
    swordCount: number,
): boolean {
    return upgrade !== RogueUpgrade.AddSword ||
        swordCount < MAX_FLYING_SWORD_UPGRADE_COUNT;
}

function applyUpgradeToPlayer(
    upgrade: number,
    players: Players,
): void {
    const iter = players.iter();
    while (iter.next()) {
        const [
            count,
            ,
            ,
            ,
            ,
            ,
            motion,
            ,
            health,
            movement,
            ,
            pickup,
        ] = iter.current;
        if (count === 0) continue;
        if (upgrade === RogueUpgrade.BodyTechnique) {
            movement[PlayerMovement.Speed][0] *= 1.12;
            motion[MoveTowards3.MaximumSpeed][0] =
                movement[PlayerMovement.Speed][0];
        } else if (upgrade === RogueUpgrade.ProtectiveBody) {
            health[Health.Maximum][0] += 20;
            health[Health.Current][0] = Math.min(
                health[Health.Maximum][0],
                health[Health.Current][0] + 20,
            );
        } else if (upgrade === RogueUpgrade.GatherSpirit) {
            pickup[PlayerPickup.AttractionRadius][0] *= 1.25;
        }
        return;
    }
}

function applyUpgradeToSwordGroup(
    upgrade: number,
    groups: AutoGroups,
): void {
    const iter = groups.iter();
    while (iter.next()) {
        const [count, , auto] = iter.current;
        if (count === 0) continue;
        if (upgrade === RogueUpgrade.TemperSword) {
            auto[AutoFlyingSwordSkill.Damage][0] *= 1.25;
        } else if (upgrade === RogueUpgrade.ShortenCooldown) {
            auto[AutoFlyingSwordSkill.ReattackDelayTicks][0] = Math.max(
                1,
                Math.floor(
                    auto[AutoFlyingSwordSkill.ReattackDelayTicks][0] *
                    0.9,
                ),
            );
        }
        return;
    }
}

function decrementPendingChoice(players: Players): void {
    const iter = players.iter();
    while (iter.next()) {
        const [
            count,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            levels,
        ] = iter.current;
        if (count === 0) continue;
        const pending = levels[LevelExperience.PendingChoices];
        if (pending[0] > 0) pending[0]--;
        return;
    }
}

function advanceRogueRunClock(
    time: Readonly<TimeState>,
    runs: Runs,
): void {
    const iter = runs.iter();
    while (iter.next()) {
        const [count, , , clocks, statuses] = iter.current;
        const ticks = clocks[RogueRunClock.Tick];
        const phases = statuses[RogueRunStatus.Phase];
        for (let row = 0; row < count; row++) {
            if (phases[row] !== RogueRunPhase.Playing) continue;
            ticks[row] = time.tick;
        }
    }
}

function directEnemySpawns(
    catalog: Readonly<EnemyCatalog>,
    tuning: Readonly<RogueRunTuning>,
    content: RogueContentService,
    runs: Runs,
    players: Players,
): void {
    let playerX = 0;
    let playerZ = 0;
    let hasPlayer = false;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , positions] = playerIter.current;
        if (count === 0) continue;
        playerX = positions[Float3.X][0];
        playerZ = positions[Float3.Z][0];
        hasPlayer = true;
        break;
    }
    if (!hasPlayer) return;

    const iter = runs.iter();
    while (iter.next()) {
        const [
            count,
            ,
            ,
            clocks,
            statuses,
            randoms,
            statistics,
            directors,
        ] = iter.current;
        const ticks = clocks[RogueRunClock.Tick];
        const phases = statuses[RogueRunStatus.Phase];
        const randomStates = randoms[RogueRunRandom.State];
        const activeEnemies =
            statistics[RogueRunStatistics.ActiveEnemies];
        const budgets = directors[EnemyDirector.Budget];
        const initialTargets = directors[EnemyDirector.InitialTarget];
        const spawnSerials = directors[EnemyDirector.SpawnSerial];
        for (let row = 0; row < count; row++) {
            if (phases[row] !== RogueRunPhase.Playing) continue;
            const tick = ticks[row];
            let budget = budgets[row] +
                tuning.baseBudgetPerTick +
                tick * tuning.budgetGrowthPerTick;
            if (activeEnemies[row] < initialTargets[row]) {
                budget += tuning.maximumSpawnsPerTick;
            }
            let randomState = randomStates[row];
            let spawned = 0;
            while (
                spawned < tuning.maximumSpawnsPerTick &&
                budget >= 0.6
            ) {
                randomState = nextRogueRandom(randomState);
                const roll = randomState / 0x100000000;
                const kind = chooseEnemyKind(tick, roll);
                const cost = catalog.cost[kind];
                if (budget < cost && activeEnemies[row] >= initialTargets[row]) {
                    break;
                }
                randomState = nextRogueRandom(randomState);
                const angle =
                    randomState / 0x100000000 * Math.PI * 2;
                randomState = nextRogueRandom(randomState);
                const radius = tuning.spawnRadius +
                    randomState / 0x100000000 * 4;
                const healthScale = 1 + tick / (60 * 240) * 1.8;
                content.spawnEnemy(
                    kind,
                    playerX + Math.cos(angle) * radius,
                    playerZ + Math.sin(angle) * radius,
                    playerX,
                    playerZ,
                    healthScale,
                );
                budget = Math.max(0, budget - cost);
                activeEnemies[row]++;
                spawnSerials[row]++;
                spawned++;
            }
            budgets[row] = budget;
            randomStates[row] = randomState;
        }
    }
}

function updateEnemyIntent(
    runs: Runs,
    players: Players,
    enemies: Enemies,
): void {
    let playing = false;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [count, , , , statuses] = runIter.current;
        if (
            count > 0 &&
            statuses[RogueRunStatus.Phase][0] === RogueRunPhase.Playing
        ) {
            playing = true;
        }
        break;
    }
    let playerX = 0;
    let playerY = 0;
    let playerZ = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , positions] = playerIter.current;
        if (count === 0) continue;
        playerX = positions[Float3.X][0];
        playerY = positions[Float3.Y][0];
        playerZ = positions[Float3.Z][0];
        break;
    }
    const iter = enemies.iter();
    while (iter.next()) {
        const [count, , , , velocities, , motion] = iter.current;
        const velocityXs = velocities[Float3.X];
        const velocityYs = velocities[Float3.Y];
        const velocityZs = velocities[Float3.Z];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        const maximumSpeeds = motion[MoveTowards3.MaximumSpeed];
        for (let row = 0; row < count; row++) {
            if (!playing) {
                maximumSpeeds[row] = 0;
                velocityXs[row] = 0;
                velocityYs[row] = 0;
                velocityZs[row] = 0;
                continue;
            }
            targetXs[row] = playerX;
            targetYs[row] = playerY;
            targetZs[row] = playerZ;
        }
    }
}

function driveScatterFlyingSwords(
    flyingSwords: FlyingSwordService,
    skills: FlyingSwordSkillService,
    scratch: Mut<CombatScratchState>,
    targeting: Mut<FlyingSwordTargetingState>,
    runs: Runs,
    players: Players,
    enemies: Enemies,
    groups: AutoGroups,
    swords: CombatSwords,
    tasks: SwordTasks,
    swordGroups: SwordGroups,
): void {
    let tick = 0;
    let phase = RogueRunPhase.Defeat;
    let swordGroup = 0 as Entity;
    let skillTargetXs: Float32Array | undefined;
    let skillTargetYs: Float32Array | undefined;
    let skillTargetZs: Float32Array | undefined;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [
            count,
            ,
            identities,
            clocks,
            statuses,
            ,
            ,
            ,
            targets,
        ] = runIter.current;
        if (count === 0) continue;
        tick = clocks[RogueRunClock.Tick][0];
        phase = statuses[RogueRunStatus.Phase][0];
        swordGroup = identities[RogueRunIdentity.SwordGroup][0];
        skillTargetXs = targets[RogueRunTarget.SkillX];
        skillTargetYs = targets[RogueRunTarget.SkillY];
        skillTargetZs = targets[RogueRunTarget.SkillZ];
        break;
    }
    if (
        phase !== RogueRunPhase.Playing ||
        swordGroup === 0 ||
        skills.phase(swordGroup) !== FlyingSwordSkillPhase.Idle
    ) {
        return;
    }
    const behavior = findSwordGroupBehavior(swordGroup, swordGroups);
    if (
        behavior.stance !== FlyingSwordStance.Scatter ||
        behavior.activeFormation !== FlyingSwordActiveFormation.None
    ) {
        return;
    }
    scratch.activeTaskSwords.clear();
    const taskIter = tasks.iter();
    while (taskIter.next()) {
        const [count, entities] = taskIter.current;
        for (let row = 0; row < count; row++) {
            scratch.activeTaskSwords.add(entities[row]);
        }
    }
    let availableSwordCount = 0;
    const availabilityIter = swords.iter();
    while (availabilityIter.next()) {
        const [
            count,
            entities,
            members,
            ,
            ,
            ,
            combat,
        ] = availabilityIter.current;
        const swordGroups = members[FlyingSwordMember.Group];
        const nextAttackTicks =
            combat[FlyingSwordCombat.NextAttackTick];
        for (let row = 0; row < count; row++) {
            if (
                swordGroups[row] === swordGroup &&
                !scratch.activeTaskSwords.has(entities[row]) &&
                tick >= nextAttackTicks[row]
            ) {
                availableSwordCount++;
            }
        }
    }
    if (availableSwordCount === 0) return;
    let playerX = 0;
    let playerZ = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , positions] = playerIter.current;
        if (count === 0) continue;
        playerX = positions[Float3.X][0];
        playerZ = positions[Float3.Z][0];
        break;
    }

    let targetRadiusSquared = 0;
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [count, entities, auto] = groupIter.current;
        const targetRadii =
            auto[AutoFlyingSwordSkill.TargetRadius];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== swordGroup) continue;
            targetRadiusSquared =
                targetRadii[row] * targetRadii[row];
            break;
        }
        if (targetRadiusSquared > 0) break;
    }
    if (targetRadiusSquared <= 0) return;

    targeting.reset();
    const enemyIter = enemies.iter();
    while (enemyIter.next()) {
        const [
            count,
            entities,
            positions,
            ,
            ,
            ,
            ,
            identities,
            bodies,
            ,
            health,
        ] = enemyIter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const priorities = identities[EnemyIdentity.Priority];
        const centerHeights = bodies[EnemyBody.CenterHeight];
        const currentHealth = health[Health.Current];
        for (let row = 0; row < count; row++) {
            if (currentHealth[row] <= 0) continue;
            const dx = xs[row] - playerX;
            const dz = zs[row] - playerZ;
            const distance = dx * dx + dz * dz;
            if (distance > targetRadiusSquared) continue;
            targeting.insert(
                entities[row],
                xs[row],
                ys[row] + centerHeights[row],
                zs[row],
                distance,
                priorities[row],
            );
        }
    }
    const candidateCount = targeting.count;
    if (candidateCount === 0) return;
    const sortedCandidateCount = Math.min(
        candidateCount,
        availableSwordCount,
    );
    for (let start = 0; start < sortedCandidateCount; start++) {
        targeting.swap(
            start,
            findBestTargetCandidate(targeting, start),
        );
    }

    let assignment = 0;
    const swordIter = swords.iter();
    while (swordIter.next()) {
        const [
            count,
            entities,
            members,
            ,
            ,
            ,
            combat,
        ] = swordIter.current;
        const swordGroups = members[FlyingSwordMember.Group];
        const assignedTargets = combat[FlyingSwordCombat.Target];
        const nextAttackTicks =
            combat[FlyingSwordCombat.NextAttackTick];
        for (let row = 0; row < count; row++) {
            const sword = entities[row];
            if (
                swordGroups[row] !== swordGroup ||
                scratch.activeTaskSwords.has(sword) ||
                tick < nextAttackTicks[row]
            ) {
                continue;
            }
            const candidate = assignment % candidateCount;
            castTarget.x = targeting.xs[candidate];
            castTarget.y = targeting.ys[candidate];
            castTarget.z = targeting.zs[candidate];
            assignedTargets[row] = targeting.entities[candidate] as Entity;
            nextAttackTicks[row] = tick + TASK_REQUEST_GUARD_TICKS;
            flyingSwords.attack(sword, castTarget);
            assignment++;
        }
    }
    if (assignment === 0) return;

    const primaryX = targeting.xs[0];
    const primaryY = targeting.ys[0];
    const primaryZ = targeting.zs[0];
    castTarget.x = primaryX;
    castTarget.y = primaryY;
    castTarget.z = primaryZ;
    if (skillTargetXs && skillTargetYs && skillTargetZs) {
        skillTargetXs[0] = primaryX;
        skillTargetYs[0] = primaryY;
        skillTargetZs[0] = primaryZ;
    }
}

function findSwordGroupBehavior(
    group: Entity,
    groups: SwordGroups,
): { stance: number; activeFormation: number } {
    const iter = groups.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            ,
            ,
            ,
            ,
            ,
            behaviors,
        ] = iter.current;
        const stances = behaviors[FlyingSwordBehavior.Stance];
        const activeFormations =
            behaviors[FlyingSwordBehavior.ActiveFormation];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== group) continue;
            groupBehavior.stance = stances[row];
            groupBehavior.activeFormation = activeFormations[row];
            return groupBehavior;
        }
    }
    groupBehavior.stance = FlyingSwordStance.Guard;
    groupBehavior.activeFormation = FlyingSwordActiveFormation.None;
    return groupBehavior;
}

function findBestTargetCandidate(
    targeting: Readonly<FlyingSwordTargetingState>,
    start: number,
): number {
    let best = start;
    for (let candidate = start + 1; candidate < targeting.count; candidate++) {
        if (
            targeting.priorities[candidate] >
                targeting.priorities[best] ||
            (
                targeting.priorities[candidate] ===
                    targeting.priorities[best] &&
                targeting.distances[candidate] <
                    targeting.distances[best]
            )
        ) {
            best = candidate;
        }
    }
    return best;
}

function rebuildEnemySpatialIndex(
    index: Mut<EnemySpatialIndexState>,
    players: Players,
    enemies: Enemies,
): void {
    let playerX = 0;
    let playerZ = 0;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , positions] = playerIter.current;
        if (count === 0) continue;
        playerX = positions[Float3.X][0];
        playerZ = positions[Float3.Z][0];
        break;
    }
    index.reset(playerX, playerZ);
    const iter = enemies.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            positions,
            ,
            ,
            ,
            ,
            ,
            bodies,
            ,
            health,
        ] = iter.current;
        index.ensureCapacity(index.count + count);
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const radii = bodies[EnemyBody.Radius];
        const centerHeights = bodies[EnemyBody.CenterHeight];
        const currentHealth = health[Health.Current];
        for (let row = 0; row < count; row++) {
            if (currentHealth[row] <= 0) continue;
            index.insert(
                entities[row],
                xs[row],
                ys[row] + centerHeights[row],
                zs[row],
                radii[row],
            );
        }
    }
}

function collideFlyingSwordsWithEnemies(
    commands: Commands,
    world: World,
    scratch: Mut<CombatScratchState>,
    index: Mut<EnemySpatialIndexState>,
    content: RogueContentService,
    flyingSwords: FlyingSwordService,
    time: Readonly<TimeState>,
    groups: AutoGroups,
    skillActions: SkillActions,
    contacts: SwordContacts,
    taskContacts: SwordTaskContacts,
    swords: CombatSwords,
    tasks: SwordTasks,
    actions: SwordActions,
    swordGroups: SwordGroups,
    players: Players,
): void {
    buildActionSnapshots(scratch, skillActions, groups);
    buildCombatMembership(
        scratch,
        tasks,
        actions,
        swordGroups,
    );
    collideFocusSwordContacts(
        scratch,
        index,
        content,
        contacts,
    );
    collideTaskSwordContacts(
        world,
        flyingSwords,
        time.tick,
        content,
        scratch,
        taskContacts,
    );
    collideFormationSwordContacts(
        world,
        time.tick,
        scratch,
        index,
        content,
        swords,
    );
    collideSwordBodyUnity(
        commands,
        world,
        time.tick,
        index,
        content,
        flyingSwords,
        players,
    );
}

function collideFocusSwordContacts(
    scratch: Readonly<CombatScratchState>,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    contacts: SwordContacts,
): void {
    if (scratch.actionCount === 0) return;
    const iter = contacts.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            actions,
            ,
            previousPositions,
            positions,
            ,
            combat,
        ] = iter.current;
        const groupEntities = members[FlyingSwordMember.Group];
        const actionEntities = actions[FlyingSwordAction.Action];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const rememberedActions =
            combat[FlyingSwordCombat.FocusAction];
        const rememberedStartTicks =
            combat[FlyingSwordCombat.FocusActionStartTick];
        const hitConsumed =
            combat[FlyingSwordCombat.FocusHitConsumed];
        for (let row = 0; row < count; row++) {
            const actionEntity = actionEntities[row];
            if (actionEntity === 0) continue;
            const action = findActionSnapshot(
                scratch,
                actionEntity,
                groupEntities[row],
            );
            if (action < 0) continue;
            const actionStartTick = scratch.startTicks[action];
            if (
                rememberedActions[row] !== actionEntity ||
                rememberedStartTicks[row] !== actionStartTick
            ) {
                rememberedActions[row] = actionEntity;
                rememberedStartTicks[row] = actionStartTick;
                hitConsumed[row] = 0;
            }
            if (hitConsumed[row] !== 0) continue;
            const enemy = findSwordSegmentHit(
                index,
                previousXs[row],
                previousYs[row],
                previousZs[row],
                xs[row],
                ys[row],
                zs[row],
            );
            if (enemy === INVALID_ENTITY) continue;
            hitConsumed[row] = 1;
            content.requestDamage(
                entities[row],
                enemy,
                scratch.damages[action],
            );
        }
    }
}

function collideTaskSwordContacts(
    world: World,
    flyingSwords: FlyingSwordService,
    tick: number,
    content: RogueContentService,
    scratch: Readonly<CombatScratchState>,
    contacts: SwordTaskContacts,
): void {
    const iter = contacts.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            ,
            ,
            previousPositions,
            positions,
            ,
            combat,
        ] = iter.current;
        const groupEntities = members[FlyingSwordMember.Group];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const targets = combat[FlyingSwordCombat.Target];
        const nextAttackTicks =
            combat[FlyingSwordCombat.NextAttackTick];
        for (let row = 0; row < count; row++) {
            const target = targets[row] as Entity;
            if (target === INVALID_ENTITY) continue;
            const health = world.get(target, HealthType, Health.Current);
            if (health === null || health <= 0) {
                finishTaskAttack(
                    flyingSwords,
                    entities[row],
                    targets,
                    nextAttackTicks,
                    row,
                    tick,
                    scratch.groupReattackDelays.get(
                        groupEntities[row],
                    ) ?? DEFAULT_REATTACK_DELAY_TICKS,
                );
                continue;
            }
            if (
                !swordSegmentHitsEntity(
                    world,
                    target,
                    previousXs[row],
                    previousYs[row],
                    previousZs[row],
                    xs[row],
                    ys[row],
                    zs[row],
                )
            ) {
                continue;
            }
            content.requestDamage(
                entities[row],
                target,
                scratch.groupDamages.get(groupEntities[row]) ??
                    DEFAULT_SWORD_DAMAGE,
            );
            finishTaskAttack(
                flyingSwords,
                entities[row],
                targets,
                nextAttackTicks,
                row,
                tick,
                scratch.groupReattackDelays.get(
                    groupEntities[row],
                ) ?? DEFAULT_REATTACK_DELAY_TICKS,
            );
        }
    }
}

function finishTaskAttack(
    flyingSwords: FlyingSwordService,
    sword: Entity,
    targets: Uint32Array,
    nextAttackTicks: Uint32Array,
    row: number,
    tick: number,
    delayTicks: number,
): void {
    targets[row] = INVALID_ENTITY;
    nextAttackTicks[row] = tick + delayTicks;
    flyingSwords.finishAttack(sword);
}

function swordSegmentHitsEntity(
    world: World,
    enemy: Entity,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): boolean {
    const x = world.get(enemy, Position3Type, Float3.X);
    const y = world.get(enemy, Position3Type, Float3.Y);
    const z = world.get(enemy, Position3Type, Float3.Z);
    const radius = world.get(
        enemy,
        EnemyBodyType,
        EnemyBody.Radius,
    );
    const centerHeight = world.get(
        enemy,
        EnemyBodyType,
        EnemyBody.CenterHeight,
    );
    if (
        x === null || y === null || z === null ||
        radius === null || centerHeight === null
    ) {
        return false;
    }
    const hitRadius = radius + SWORD_HIT_RADIUS;
    return squaredDistanceToSegment3(
        x,
        y + centerHeight,
        z,
        startX,
        startY,
        startZ,
        endX,
        endY,
        endZ,
    ) <= hitRadius * hitRadius;
}

function collideFormationSwordContacts(
    world: World,
    tick: number,
    scratch: Readonly<CombatScratchState>,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    swords: CombatSwords,
): void {
    if (scratch.formationGroups.size === 0) return;
    const iter = swords.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            previousPositions,
            positions,
        ] = iter.current;
        const swordGroups = members[FlyingSwordMember.Group];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        for (let row = 0; row < count; row++) {
            const sword = entities[row];
            const group = swordGroups[row] as Entity;
            if (
                !scratch.formationGroups.has(group) ||
                scratch.activeTaskSwords.has(sword) ||
                scratch.activeActionSwords.has(sword)
            ) {
                continue;
            }
            collideFormationSegment(
                world,
                tick,
                content,
                index,
                sword,
                (
                    scratch.groupDamages.get(group) ??
                    DEFAULT_SWORD_DAMAGE
                ) *
                    FORMATION_DAMAGE_MULTIPLIER,
                previousXs[row],
                previousYs[row],
                previousZs[row],
                xs[row],
                ys[row],
                zs[row],
            );
        }
    }
}

function findSwordSegmentHit(
    index: Readonly<EnemySpatialIndexState>,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): Entity {
    const padding = 1.4;
    const minimumCellX = clampCell(
        Math.floor(
            (Math.min(startX, endX) - padding - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const maximumCellX = clampCell(
        Math.floor(
            (Math.max(startX, endX) + padding - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const minimumCellZ = clampCell(
        Math.floor(
            (Math.min(startZ, endZ) - padding - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    const maximumCellZ = clampCell(
        Math.floor(
            (Math.max(startZ, endZ) + padding - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    let best = INVALID_ENTITY;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (
            let cellX = minimumCellX;
            cellX <= maximumCellX;
            cellX++
        ) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
                const radius = index.radii[candidate] + SWORD_HIT_RADIUS;
                if (
                    squaredDistanceToSegment3(
                        index.xs[candidate],
                        index.ys[candidate],
                        index.zs[candidate],
                        startX,
                        startY,
                        startZ,
                        endX,
                        endY,
                        endZ,
                    ) <= radius * radius
                ) {
                    const dx = index.xs[candidate] - startX;
                    const dy = index.ys[candidate] - startY;
                    const dz = index.zs[candidate] - startZ;
                    const distance = dx * dx + dy * dy + dz * dz;
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        best = index.entities[candidate] as Entity;
                    }
                }
                candidate = index.next[candidate];
            }
        }
    }
    return best;
}

function collideFormationSegment(
    world: World,
    tick: number,
    content: RogueContentService,
    index: Readonly<EnemySpatialIndexState>,
    source: Entity,
    damage: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): void {
    const padding = 1.4;
    const minimumCellX = clampCell(
        Math.floor(
            (Math.min(startX, endX) - padding - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const maximumCellX = clampCell(
        Math.floor(
            (Math.max(startX, endX) + padding - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const minimumCellZ = clampCell(
        Math.floor(
            (Math.min(startZ, endZ) - padding - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    const maximumCellZ = clampCell(
        Math.floor(
            (Math.max(startZ, endZ) + padding - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
                const enemy = index.entities[candidate] as Entity;
                const radius = index.radii[candidate] + SWORD_HIT_RADIUS;
                if (
                    squaredDistanceToSegment3(
                        index.xs[candidate],
                        index.ys[candidate],
                        index.zs[candidate],
                        startX,
                        startY,
                        startZ,
                        endX,
                        endY,
                        endZ,
                    ) <= radius * radius
                ) {
                    const nextTick = world.get(
                        enemy,
                        FlyingSwordContactCooldownType,
                        FlyingSwordContactCooldown.FormationNextTick,
                    );
                    if (nextTick !== null && tick >= nextTick) {
                        world.set(
                            enemy,
                            FlyingSwordContactCooldownType,
                            FlyingSwordContactCooldown.FormationNextTick,
                            tick + FORMATION_CONTACT_COOLDOWN_TICKS,
                        );
                        content.requestDamage(source, enemy, damage);
                    }
                }
                candidate = index.next[candidate];
            }
        }
    }
}

function buildCombatMembership(
    scratch: Mut<CombatScratchState>,
    tasks: SwordTasks,
    actions: SwordActions,
    groups: SwordGroups,
): void {
    scratch.resetMembership();
    const taskIter = tasks.iter();
    while (taskIter.next()) {
        const [count, entities] = taskIter.current;
        for (let row = 0; row < count; row++) {
            scratch.activeTaskSwords.add(entities[row]);
        }
    }
    const actionIter = actions.iter();
    while (actionIter.next()) {
        const [count, entities] = actionIter.current;
        for (let row = 0; row < count; row++) {
            scratch.activeActionSwords.add(entities[row]);
        }
    }
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [
            count,
            entities,
            ,
            ,
            ,
            ,
            ,
            behaviors,
        ] = groupIter.current;
        const stances = behaviors[FlyingSwordBehavior.Stance];
        const activeFormations =
            behaviors[FlyingSwordBehavior.ActiveFormation];
        for (let row = 0; row < count; row++) {
            if (
                stances[row] === FlyingSwordStance.Formation &&
                activeFormations[row] ===
                    FlyingSwordActiveFormation.None
            ) {
                scratch.formationGroups.add(entities[row]);
            }
        }
    }
}

function collideSwordBodyUnity(
    commands: Commands,
    world: World,
    tick: number,
    index: Readonly<EnemySpatialIndexState>,
    content: RogueContentService,
    flyingSwords: FlyingSwordService,
    players: Players,
): void {
    const iter = players.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            positions,
            previousPositions,
            velocities,
            ,
            motion,
            ,
            ,
            movement,
            ,
            ,
            actions,
        ] = iter.current;
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const velocityXs = velocities[Float3.X];
        const velocityYs = velocities[Float3.Y];
        const velocityZs = velocities[Float3.Z];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        const maximumSpeeds = motion[MoveTowards3.MaximumSpeed];
        const accelerations = motion[MoveTowards3.Acceleration];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];
        const movementSpeeds = movement[PlayerMovement.Speed];
        const active = actions[SwordBodyUnity.Active];
        const endTicks = actions[SwordBodyUnity.EndTick];
        const damages = actions[SwordBodyUnity.Damage];
        const groups = actions[SwordBodyUnity.Group];
        for (let row = 0; row < count; row++) {
            if (active[row] === 0) continue;
            collideFusionSegment(
                world,
                tick,
                content,
                index,
                entities[row],
                damages[row],
                previousXs[row],
                previousYs[row] + FUSION_BODY_HEIGHT,
                previousZs[row],
                xs[row],
                ys[row] + FUSION_BODY_HEIGHT,
                zs[row],
            );
            const dx = targetXs[row] - xs[row];
            const dy = targetYs[row] - ys[row];
            const dz = targetZs[row] - zs[row];
            const arrival = arrivalRadii[row];
            if (
                tick < endTicks[row] &&
                dx * dx + dy * dy + dz * dz > arrival * arrival
            ) {
                continue;
            }
            active[row] = 0;
            targetXs[row] = xs[row];
            targetYs[row] = ys[row];
            targetZs[row] = zs[row];
            maximumSpeeds[row] = movementSpeeds[row];
            accelerations[row] = PLAYER_MOVEMENT_ACCELERATION;
            arrivalRadii[row] = PLAYER_MOVEMENT_ARRIVAL_RADIUS;
            velocityXs[row] = 0;
            velocityYs[row] = 0;
            velocityZs[row] = 0;
            commands
                .entity(entities[row])
                .remove(CultivatorMoveActiveTag)
                .submit();
            if (groups[row] !== INVALID_ENTITY) {
                flyingSwords.endActiveFormation(groups[row] as Entity);
            }
        }
    }
}

function collideFusionSegment(
    world: World,
    tick: number,
    content: RogueContentService,
    index: Readonly<EnemySpatialIndexState>,
    source: Entity,
    damage: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): void {
    const padding = FUSION_HIT_RADIUS + 1.2;
    const minimumCellX = clampCell(
        Math.floor(
            (Math.min(startX, endX) - padding - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const maximumCellX = clampCell(
        Math.floor(
            (Math.max(startX, endX) + padding - index.originX) /
            GRID_CELL_SIZE,
        ),
        GRID_WIDTH,
    );
    const minimumCellZ = clampCell(
        Math.floor(
            (Math.min(startZ, endZ) - padding - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    const maximumCellZ = clampCell(
        Math.floor(
            (Math.max(startZ, endZ) + padding - index.originZ) /
            GRID_CELL_SIZE,
        ),
        GRID_HEIGHT,
    );
    for (let cellZ = minimumCellZ; cellZ <= maximumCellZ; cellZ++) {
        for (let cellX = minimumCellX; cellX <= maximumCellX; cellX++) {
            let candidate =
                index.cellHeads[cellZ * GRID_WIDTH + cellX];
            while (candidate !== -1) {
                const enemy = index.entities[candidate] as Entity;
                const radius =
                    index.radii[candidate] + FUSION_HIT_RADIUS;
                if (
                    squaredDistanceToSegment3(
                        index.xs[candidate],
                        index.ys[candidate],
                        index.zs[candidate],
                        startX,
                        startY,
                        startZ,
                        endX,
                        endY,
                        endZ,
                    ) <= radius * radius
                ) {
                    const nextTick = world.get(
                        enemy,
                        FlyingSwordContactCooldownType,
                        FlyingSwordContactCooldown.FusionNextTick,
                    );
                    if (nextTick !== null && tick >= nextTick) {
                        world.set(
                            enemy,
                            FlyingSwordContactCooldownType,
                            FlyingSwordContactCooldown.FusionNextTick,
                            tick + FUSION_CONTACT_COOLDOWN_TICKS,
                        );
                        content.requestDamage(source, enemy, damage);
                    }
                }
                candidate = index.next[candidate];
            }
        }
    }
}

function collideEnemiesWithPlayer(
    tuning: Readonly<RogueRunTuning>,
    content: RogueContentService,
    runs: Runs,
    players: Players,
    enemies: Enemies,
): void {
    let phase = RogueRunPhase.Defeat;
    let tick = 0;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [count, , , clocks, statuses] = runIter.current;
        if (count === 0) continue;
        tick = clocks[RogueRunClock.Tick][0];
        phase = statuses[RogueRunStatus.Phase][0];
        break;
    }
    if (phase !== RogueRunPhase.Playing) return;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [
            playerCount,
            playerEntities,
            playerPositions,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            unity,
        ] =
            playerIter.current;
        if (playerCount === 0) continue;
        if (unity[SwordBodyUnity.Active][0] !== 0) return;
        const player = playerEntities[0];
        const playerX = playerPositions[Float3.X][0];
        const playerZ = playerPositions[Float3.Z][0];
        const enemyIter = enemies.iter();
        while (enemyIter.next()) {
            const [
                count,
                entities,
                positions,
                ,
                ,
                ,
                ,
                ,
                bodies,
                combat,
                health,
            ] = enemyIter.current;
            const xs = positions[Float3.X];
            const zs = positions[Float3.Z];
            const radii = bodies[EnemyBody.Radius];
            const damages = combat[EnemyCombat.ContactDamage];
            const nextContactTicks =
                combat[EnemyCombat.NextContactTick];
            const currentHealth = health[Health.Current];
            for (let row = 0; row < count; row++) {
                if (
                    currentHealth[row] <= 0 ||
                    tick < nextContactTicks[row]
                ) {
                    continue;
                }
                const dx = xs[row] - playerX;
                const dz = zs[row] - playerZ;
                const radius = radii[row] + PLAYER_RADIUS;
                if (dx * dx + dz * dz > radius * radius) continue;
                nextContactTicks[row] =
                    tick + tuning.contactCooldownTicks;
                content.requestDamage(
                    entities[row],
                    player,
                    damages[row],
                );
            }
        }
        return;
    }
}

function resolveRogueDamage(
    commands: Commands,
    world: World,
    scratch: Mut<RogueEntityAccessState>,
    requests: DamageRequests,
): void {
    const component = world.findComponent(HealthType);
    if (!component) return;
    const componentId = component.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const targets = data[DamageRequest.Target];
        const amounts = data[DamageRequest.Amount];
        for (let row = 0; row < count; row++) {
            const target = targets[row];
            if (world.resolve(target, access) && access.archetype) {
                const health = access.archetype.getComp(
                    access.row,
                    componentId,
                ) as ComponentColumns<HealthType> | null;
                if (health) {
                    const localRow =
                        access.archetype.rowIdxOf(access.row);
                    const current = health[Health.Current];
                    current[localRow] = Math.max(
                        0,
                        current[localRow] - Math.max(0, amounts[row]),
                    );
                }
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function reactToRogueDeaths(
    commands: Commands,
    content: RogueContentService,
    runs: Runs,
    players: Players,
    enemies: Enemies,
): void {
    let runKills: Uint32Array | undefined;
    let runActiveEnemies: Uint32Array | undefined;
    let runPhases: Uint8Array | undefined;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [count, , , , statuses, , statistics] =
            runIter.current;
        if (count === 0) continue;
        runPhases = statuses[RogueRunStatus.Phase];
        runKills = statistics[RogueRunStatistics.Kills];
        runActiveEnemies =
            statistics[RogueRunStatistics.ActiveEnemies];
        break;
    }
    if (!runKills || !runActiveEnemies || !runPhases) return;

    const enemyIter = enemies.iter();
    while (enemyIter.next()) {
        const [
            count,
            entities,
            positions,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            health,
            experience,
        ] = enemyIter.current;
        const xs = positions[Float3.X];
        const zs = positions[Float3.Z];
        const currentHealth = health[Health.Current];
        const rewards = experience[ExperienceReward.Value];
        for (let row = 0; row < count; row++) {
            if (currentHealth[row] > 0) continue;
            content.spawnExperience(xs[row], zs[row], rewards[row]);
            commands.entity(entities[row]).despawn().submit();
            runKills[0]++;
            if (runActiveEnemies[0] > 0) runActiveEnemies[0]--;
        }
    }

    const playerIter = players.iter();
    while (playerIter.next()) {
        const [
            count,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            health,
        ] = playerIter.current;
        if (
            count > 0 &&
            health[Health.Current][0] <= 0
        ) {
            runPhases[0] = RogueRunPhase.Defeat;
        }
        break;
    }
}

function collectRogueExperience(
    time: Readonly<TimeState>,
    commands: Commands,
    runs: Runs,
    players: Players,
    pickups: Pickups,
): void {
    let playing = false;
    const runIter = runs.iter();
    while (runIter.next()) {
        const [count, , , , statuses] = runIter.current;
        playing = count > 0 &&
            statuses[RogueRunStatus.Phase][0] === RogueRunPhase.Playing;
        break;
    }
    if (!playing) return;
    const playerIter = players.iter();
    while (playerIter.next()) {
        const [
            playerCount,
            ,
            playerPositions,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            levels,
            pickupRules,
        ] = playerIter.current;
        if (playerCount === 0) continue;
        const playerX = playerPositions[Float3.X][0];
        const playerY = playerPositions[Float3.Y][0];
        const playerZ = playerPositions[Float3.Z][0];
        const attractionRadius =
            pickupRules[PlayerPickup.AttractionRadius][0];
        const attractionRadiusSquared =
            attractionRadius * attractionRadius;
        const pickupRadius =
            pickupRules[PlayerPickup.PickupRadius][0];
        const pickupRadiusSquared = pickupRadius * pickupRadius;
        const attractionSpeed =
            pickupRules[PlayerPickup.AttractionSpeed][0];
        const currentExperience =
            levels[LevelExperience.Current];
        const requiredExperience =
            levels[LevelExperience.Required];
        const levelValues = levels[LevelExperience.Level];
        const pendingChoices =
            levels[LevelExperience.PendingChoices];

        const pickupIter = pickups.iter();
        while (pickupIter.next()) {
            const [
                count,
                entities,
                positions,
                previousPositions,
                velocities,
                values,
            ] = pickupIter.current;
            const xs = positions[Float3.X];
            const ys = positions[Float3.Y];
            const zs = positions[Float3.Z];
            const previousXs = previousPositions[Float3.X];
            const previousYs = previousPositions[Float3.Y];
            const previousZs = previousPositions[Float3.Z];
            const velocityXs = velocities[Float3.X];
            const velocityYs = velocities[Float3.Y];
            const velocityZs = velocities[Float3.Z];
            const experienceValues = values[ExperiencePickup.Value];
            for (let row = 0; row < count; row++) {
                const x = xs[row];
                const y = ys[row];
                const z = zs[row];
                previousXs[row] = x;
                previousYs[row] = y;
                previousZs[row] = z;
                const dx = playerX - x;
                const dy = playerY + 0.5 - y;
                const dz = playerZ - z;
                const distanceSquared = dx * dx + dy * dy + dz * dz;
                if (distanceSquared <= pickupRadiusSquared) {
                    currentExperience[0] += experienceValues[row];
                    commands.entity(entities[row]).despawn().submit();
                    continue;
                }
                if (distanceSquared > attractionRadiusSquared) {
                    velocityXs[row] = 0;
                    velocityYs[row] = 0;
                    velocityZs[row] = 0;
                    continue;
                }
                const distance = Math.sqrt(distanceSquared);
                const inverseDistance =
                    distance > 1e-5 ? 1 / distance : 0;
                const speed = attractionSpeed + distance * 2.5;
                velocityXs[row] = dx * inverseDistance * speed;
                velocityYs[row] = dy * inverseDistance * speed;
                velocityZs[row] = dz * inverseDistance * speed;
                xs[row] = x + velocityXs[row] * time.delta;
                ys[row] = y + velocityYs[row] * time.delta;
                zs[row] = z + velocityZs[row] * time.delta;
            }
        }

        while (currentExperience[0] >= requiredExperience[0]) {
            currentExperience[0] -= requiredExperience[0];
            levelValues[0]++;
            pendingChoices[0] = Math.min(255, pendingChoices[0] + 1);
            requiredExperience[0] = rogueRequiredExperienceFor(
                levelValues[0],
            );
        }
        return;
    }
}

function buildActionSnapshots(
    scratch: Mut<CombatScratchState>,
    actions: SkillActions,
    groups: AutoGroups,
): void {
    let required = 0;
    const countIter = actions.iter();
    while (countIter.next()) required += countIter.current[0];
    scratch.reset(required);
    scratch.groupDamages.clear();
    scratch.groupReattackDelays.clear();
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [count, entities, data] = groupIter.current;
        const damages = data[AutoFlyingSwordSkill.Damage];
        const reattackDelays =
            data[AutoFlyingSwordSkill.ReattackDelayTicks];
        for (let row = 0; row < count; row++) {
            scratch.groupDamages.set(entities[row], damages[row]);
            scratch.groupReattackDelays.set(
                entities[row],
                reattackDelays[row],
            );
        }
    }
    const iter = actions.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            identities,
            ,
            timings,
            progresses,
        ] = iter.current;
        const groupEntities =
            identities[FlyingSwordSkillAction.Group];
        const startTicks = timings[FlyingSwordSkillTiming.StartTick];
        const reserved =
            progresses[FlyingSwordSkillProgress.ReservedCount];
        for (let row = 0; row < count; row++) {
            const index = scratch.actionCount++;
            const group = groupEntities[row];
            scratch.actionEntities[index] = entities[row];
            scratch.actionGroups[index] = group;
            scratch.startTicks[index] = startTicks[row];
            scratch.reservedCounts[index] = reserved[row];
            scratch.damages[index] =
                scratch.groupDamages.get(group) ??
                DEFAULT_SWORD_DAMAGE;
        }
    }
}

function findActionSnapshot(
    scratch: Readonly<CombatScratchState>,
    actionEntity: Entity,
    group: Entity,
): number {
    const actionEntities = scratch.actionEntities;
    const actionGroups = scratch.actionGroups;
    for (let index = 0; index < scratch.actionCount; index++) {
        if (
            actionEntities[index] === actionEntity &&
            actionGroups[index] === group
        ) {
            return index;
        }
    }
    return -1;
}

function chooseEnemyKind(tick: number, roll: number): EnemyKind {
    if (tick >= 60 * 45 && roll > 0.985) return EnemyKind.SwordWraith;
    if (tick >= 60 * 18 && roll > 0.88) return EnemyKind.StoneGolem;
    if (roll > 0.45) return EnemyKind.BonePuppet;
    return EnemyKind.CorruptedBat;
}

export function nextRogueRandom(state: number): number {
    let value = state >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    value >>>= 0;
    return value === 0 ? 0x6d2b79f5 : value;
}

function clampCell(value: number, size: number): number {
    return Math.max(0, Math.min(size - 1, value));
}

export function squaredDistanceToSegment3(
    pointX: number,
    pointY: number,
    pointZ: number,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): number {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentZ = endZ - startZ;
    const lengthSquared =
        segmentX * segmentX +
        segmentY * segmentY +
        segmentZ * segmentZ;
    let t = 0;
    if (lengthSquared > 1e-8) {
        t = (
            (pointX - startX) * segmentX +
            (pointY - startY) * segmentY +
            (pointZ - startZ) * segmentZ
        ) / lengthSquared;
        t = Math.max(0, Math.min(1, t));
    }
    const dx = pointX - (startX + segmentX * t);
    const dy = pointY - (startY + segmentY * t);
    const dz = pointZ - (startZ + segmentZ * t);
    return dx * dx + dy * dy + dz * dz;
}

export function rogueRequiredExperienceFor(level: number): number {
    return Math.round(8 + 5 * Math.pow(level, 1.35));
}

const castTarget = { x: 0, y: 0, z: 0 };
const groupBehavior = {
    stance: FlyingSwordStance.Guard as number,
    activeFormation: FlyingSwordActiveFormation.None as number,
};
const DEFAULT_SWORD_DAMAGE = 18;
const SWORD_HIT_RADIUS = 0.32;
const TASK_REQUEST_GUARD_TICKS = 2;
const DEFAULT_REATTACK_DELAY_TICKS = 6;
const FORMATION_DAMAGE_MULTIPLIER = 0.38;
const FORMATION_CONTACT_COOLDOWN_TICKS = 9;
const FUSION_BODY_HEIGHT = 0.72;
const FUSION_HIT_RADIUS = 0.88;
const FUSION_CONTACT_COOLDOWN_TICKS = 30;
const PLAYER_MOVEMENT_ACCELERATION = 48;
const PLAYER_MOVEMENT_ARRIVAL_RADIUS = 0.04;
const PLAYER_RADIUS = 0.48;
const MAX_FLYING_SWORD_UPGRADE_COUNT = 49;
