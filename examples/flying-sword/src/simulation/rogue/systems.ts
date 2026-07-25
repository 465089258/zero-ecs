import {
    Commands,
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
    FlyingSwordMember,
    FlyingSwordSkillAction,
    FlyingSwordSkillActionQuery,
    FlyingSwordSkillPhase,
    FlyingSwordSkillProgress,
    FlyingSwordSkillService,
    FlyingSwordSkillTiming,
    FlyingSwordSystemSet,
} from "@zero-ecs/flying-sword";
import {
    Float3,
} from "@zero-ecs/math/3d";
import {
    MotionSystemSet,
    MoveTowards3,
} from "@zero-ecs/motion/3d";
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
import {
    AutoFlyingSwordSkill,
    ChooseUpgradeRequest,
    DamageRequest,
    EnemyBody,
    EnemyCombat,
    EnemyDirector,
    EnemyIdentity,
    ExperiencePickup,
    ExperienceReward,
    FlyingSwordHitMemory,
    FlyingSwordHitMemoryType,
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
    RoguePlayerQuery,
    RogueRunQuery,
} from "./queries";
import {
    EnemySpatialIndexState,
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
        RogueRunQuery,
        RoguePlayerQuery,
        RogueAutoFlyingSwordGroupQuery,
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

export const autoCastFlyingSwordSystem = defSystem(
    Update.fixed,
    autoCastFlyingSword,
    [
        FlyingSwordSkillService,
        RogueRunQuery,
        RoguePlayerQuery,
        RogueEnemyQuery,
        RogueAutoFlyingSwordGroupQuery,
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
        World,
        Write(EnemySpatialIndexState),
        RogueContentService,
        RogueAutoFlyingSwordGroupQuery,
        FlyingSwordSkillActionQuery,
        RogueFlyingSwordContactQuery,
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
    runs: Runs,
    players: Players,
    groups: AutoGroups,
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
                activeSelection[0] = 0;
                decrementPendingChoice(players);
            }
            commands.entity(entities[row]).despawn().submit();
        }
    }
}

function openRogueUpgradeSelection(
    catalog: Readonly<RogueUpgradeCatalog>,
    control: RogueRunControlService,
    runs: Runs,
    players: Players,
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
            ,
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
        let randomState = randoms[RogueRunRandom.State][0];
        randomState = nextRandom(randomState);
        const first = randomState % catalog.count;
        let second = first;
        while (second === first) {
            randomState = nextRandom(randomState);
            second = randomState % catalog.count;
        }
        let third = first;
        while (third === first || third === second) {
            randomState = nextRandom(randomState);
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
            auto[AutoFlyingSwordSkill.CooldownTicks][0] = Math.max(
                72,
                Math.round(
                    auto[AutoFlyingSwordSkill.CooldownTicks][0] * 0.9,
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
                randomState = nextRandom(randomState);
                const roll = randomState / 0x100000000;
                const kind = chooseEnemyKind(tick, roll);
                const cost = catalog.cost[kind];
                if (budget < cost && activeEnemies[row] >= initialTargets[row]) {
                    break;
                }
                randomState = nextRandom(randomState);
                const angle =
                    randomState / 0x100000000 * Math.PI * 2;
                randomState = nextRandom(randomState);
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

function autoCastFlyingSword(
    skills: FlyingSwordSkillService,
    runs: Runs,
    players: Players,
    enemies: Enemies,
    groups: AutoGroups,
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

    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [count, entities, auto] = groupIter.current;
        const cooldownTicks =
            auto[AutoFlyingSwordSkill.CooldownTicks];
        const nextCastTicks =
            auto[AutoFlyingSwordSkill.NextCastTick];
        const targetRadii =
            auto[AutoFlyingSwordSkill.TargetRadius];
        for (let row = 0; row < count; row++) {
            if (
                entities[row] !== swordGroup ||
                tick < nextCastTicks[row]
            ) {
                continue;
            }
            const targetRadiusSquared =
                targetRadii[row] * targetRadii[row];
            let bestPriority = -1;
            let bestDistance = Number.POSITIVE_INFINITY;
            let bestX = 0;
            let bestY = 0;
            let bestZ = 0;
            const enemyIter = enemies.iter();
            while (enemyIter.next()) {
                const [
                    enemyCount,
                    ,
                    positions,
                    ,
                    ,
                    ,
                    ,
                    identities,
                    ,
                    ,
                    health,
                ] = enemyIter.current;
                const xs = positions[Float3.X];
                const ys = positions[Float3.Y];
                const zs = positions[Float3.Z];
                const priorities =
                    identities[EnemyIdentity.Priority];
                const currentHealth = health[Health.Current];
                for (
                    let enemyRow = 0;
                    enemyRow < enemyCount;
                    enemyRow++
                ) {
                    if (currentHealth[enemyRow] <= 0) continue;
                    const dx = xs[enemyRow] - playerX;
                    const dz = zs[enemyRow] - playerZ;
                    const distance = dx * dx + dz * dz;
                    if (distance > targetRadiusSquared) continue;
                    const priority = priorities[enemyRow];
                    if (
                        priority < bestPriority ||
                        (
                            priority === bestPriority &&
                            distance >= bestDistance
                        )
                    ) {
                        continue;
                    }
                    bestPriority = priority;
                    bestDistance = distance;
                    bestX = xs[enemyRow];
                    bestY = ys[enemyRow];
                    bestZ = zs[enemyRow];
                }
            }
            if (bestPriority < 0) return;
            castTarget.x = bestX;
            castTarget.y = bestY;
            castTarget.z = bestZ;
            skills.cast({
                group: swordGroup,
                target: castTarget,
            });
            nextCastTicks[row] = tick + cooldownTicks[row];
            if (skillTargetXs && skillTargetYs && skillTargetZs) {
                skillTargetXs[0] = bestX;
                skillTargetYs[0] = bestY;
                skillTargetZs[0] = bestZ;
            }
            return;
        }
    }
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
    world: World,
    index: Mut<EnemySpatialIndexState>,
    content: RogueContentService,
    groups: AutoGroups,
    skillActions: SkillActions,
    contacts: SwordContacts,
): void {
    const iter = contacts.iter();
    while (iter.next()) {
        const [
            count,
            ,
            members,
            actions,
            ,
            previousPositions,
            positions,
        ] = iter.current;
        const groupEntities = members[FlyingSwordMember.Group];
        const actionEntities = actions[FlyingSwordAction.Action];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        for (let row = 0; row < count; row++) {
            const actionEntity = actionEntities[row];
            if (actionEntity === 0) continue;
            const action = findAction(actionEntity, skillActions);
            if (!action.found) continue;
            const baseDamage = findGroupDamage(
                groupEntities[row],
                groups,
            );
            const damage =
                baseDamage * Math.sqrt(Math.max(1, action.reserved));
            collideSwordSegment(
                world,
                content,
                index,
                actionEntity,
                action.startTick,
                damage,
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

function collideSwordSegment(
    world: World,
    content: RogueContentService,
    index: Mut<EnemySpatialIndexState>,
    actionEntity: Entity,
    actionStartTick: number,
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
                    pointSegmentDistanceSquared(
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
                    const enemy =
                        index.entities[candidate] as Entity;
                    const lastAction = world.get(
                        enemy,
                        FlyingSwordHitMemoryType,
                        FlyingSwordHitMemory.Action,
                    );
                    const lastStartTick = world.get(
                        enemy,
                        FlyingSwordHitMemoryType,
                        FlyingSwordHitMemory.ActionStartTick,
                    );
                    if (
                        lastAction !== actionEntity ||
                        lastStartTick !== actionStartTick
                    ) {
                        world.set(
                            enemy,
                            FlyingSwordHitMemoryType,
                            FlyingSwordHitMemory.Action,
                            actionEntity,
                        );
                        world.set(
                            enemy,
                            FlyingSwordHitMemoryType,
                            FlyingSwordHitMemory.ActionStartTick,
                            actionStartTick,
                        );
                        content.requestDamage(
                            actionEntity,
                            enemy,
                            damage,
                        );
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
        const [playerCount, playerEntities, playerPositions] =
            playerIter.current;
        if (playerCount === 0) continue;
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
            requiredExperience[0] = requiredExperienceFor(
                levelValues[0],
            );
        }
        return;
    }
}

function findAction(
    actionEntity: Entity,
    actions: SkillActions,
): ActionSnapshot {
    actionSnapshot.found = false;
    const iter = actions.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            ,
            ,
            timings,
            progresses,
        ] = iter.current;
        const startTicks = timings[FlyingSwordSkillTiming.StartTick];
        const reserved =
            progresses[FlyingSwordSkillProgress.ReservedCount];
        for (let row = 0; row < count; row++) {
            if (entities[row] !== actionEntity) continue;
            actionSnapshot.found = true;
            actionSnapshot.startTick = startTicks[row];
            actionSnapshot.reserved = reserved[row];
            return actionSnapshot;
        }
    }
    return actionSnapshot;
}

function findGroupDamage(group: Entity, groups: AutoGroups): number {
    const iter = groups.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const damages = data[AutoFlyingSwordSkill.Damage];
        for (let row = 0; row < count; row++) {
            if (entities[row] === group) return damages[row];
        }
    }
    return DEFAULT_SWORD_DAMAGE;
}

function chooseEnemyKind(tick: number, roll: number): EnemyKind {
    if (tick >= 60 * 45 && roll > 0.985) return EnemyKind.SwordWraith;
    if (tick >= 60 * 18 && roll > 0.88) return EnemyKind.StoneGolem;
    if (roll > 0.45) return EnemyKind.BonePuppet;
    return EnemyKind.CorruptedBat;
}

function nextRandom(state: number): number {
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

function pointSegmentDistanceSquared(
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

function requiredExperienceFor(level: number): number {
    return Math.round(8 + 5 * Math.pow(level, 1.35));
}

interface ActionSnapshot {
    found: boolean;
    startTick: number;
    reserved: number;
}

const actionSnapshot: ActionSnapshot = {
    found: false,
    startTick: 0,
    reserved: 0,
};
const castTarget = { x: 0, y: 0, z: 0 };
const DEFAULT_SWORD_DAMAGE = 18;
const SWORD_HIT_RADIUS = 0.32;
const PLAYER_RADIUS = 0.48;
