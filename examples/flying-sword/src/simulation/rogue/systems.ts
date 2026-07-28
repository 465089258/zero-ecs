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
    FlyingSwordMember,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordSystemSet,
} from "../../domain/flying-sword";
import { Float3 } from "../../infrastructure/math";
import {
    MotionSystemSet,
    MoveTowards3,
} from "../../infrastructure/motion";
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
import {
    AutoFlyingSwordSkill,
    ChooseUpgradeRequest,
    ColdSwordIntent,
    DamageKind,
    DamageRequest,
    EnemyBody,
    EnemyBodyType,
    EnemyCombat,
    EnemyDirector,
    EnemyFeedback,
    EnemyFeedbackType,
    EnemyIdentity,
    EnemyLocomotion,
    ExperiencePickup,
    ExperienceReward,
    FireSwordIntent,
    FlyingSwordCombat,
    FlyingSwordCombatType,
    FlyingSwordPiercingSequence,
    FlyingSwordPiercingSequenceType,
    Health,
    HealthType,
    LevelExperience,
    LightningSwordIntent,
    MetalSwordIntent,
    PlayerPickup,
    PlayerStamina,
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
    RogueEnemyIntentQuery,
    RogueEnemyQuery,
    RogueExperiencePickupQuery,
    RoguePlayerQuery,
    RogueRunQuery,
} from "./queries";
import {
    RogueEntityAccessState,
} from "./state";

type Runs = QueryOf<typeof RogueRunQuery>;
type Players = QueryOf<typeof RoguePlayerQuery>;
type Enemies = QueryOf<typeof RogueEnemyQuery>;
type EnemyIntents = QueryOf<typeof RogueEnemyIntentQuery>;
type Pickups = QueryOf<typeof RogueExperiencePickupQuery>;
type DamageRequests = QueryOf<typeof RogueDamageRequestQuery>;
type AutoGroups = QueryOf<typeof RogueAutoFlyingSwordGroupQuery>;
type UpgradeRequests = QueryOf<typeof RogueChooseUpgradeRequestQuery>;
type FlyingSwords = QueryOf<typeof FlyingSwordQuery>;

export const RogueSystemSet = Object.freeze({
    ApplyUpgrade: new SystemSet(
        Update.fixed,
        "flying-sword-rogue:apply-upgrade",
    ),
    Clock: new SystemSet(Update.fixed, "flying-sword-rogue:clock"),
    Spawn: new SystemSet(Update.fixed, "flying-sword-rogue:spawn"),
    Intent: new SystemSet(Update.fixed, "flying-sword-rogue:intent"),
    EnemyResolve: new SystemSet(
        Update.fixed,
        "flying-sword-rogue:enemy-resolve",
    ),
    Targeting: new SystemSet(Update.fixed, "flying-sword-rogue:targeting"),
    Spatial: new SystemSet(Update.fixed, "flying-sword-rogue:spatial"),
    CombatSnapshot: new SystemSet(
        Update.fixed,
        "flying-sword-rogue:combat-snapshot",
    ),
    Contact: new SystemSet(Update.fixed, "flying-sword-rogue:contact"),
    DamageEffects: new SystemSet(
        Update.fixed,
        "flying-sword-rogue:damage-effects",
    ),
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
    [RogueRunQuery, RoguePlayerQuery, RogueEnemyIntentQuery],
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
        TimeState,
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
            RogueSystemSet.EnemyResolve,
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
        before: [
            RogueSystemSet.EnemyResolve,
            MotionSystemSet.Integrate3,
        ],
    },
    enemyResolve: {
        inSet: RogueSystemSet.EnemyResolve,
        after: RogueSystemSet.Intent,
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
        before: RogueSystemSet.CombatSnapshot,
    },
    combatSnapshot: {
        inSet: RogueSystemSet.CombatSnapshot,
        after: [
            RogueSystemSet.Spatial,
            FlyingSwordSystemSet.Contact,
        ],
        before: RogueSystemSet.Contact,
    },
    swordContact: {
        inSet: RogueSystemSet.Contact,
        after: RogueSystemSet.CombatSnapshot,
        before: RogueSystemSet.Damage,
    },
    playerContact: {
        inSet: RogueSystemSet.Contact,
        after: RogueSystemSet.Spatial,
        before: RogueSystemSet.Damage,
    },
    damageEffects: {
        inSet: RogueSystemSet.DamageEffects,
        after: RogueSystemSet.Contact,
        before: RogueSystemSet.Damage,
    },
    damage: {
        inSet: RogueSystemSet.Damage,
        after: RogueSystemSet.DamageEffects,
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
                applyUpgradeToSwordGroup(
                    upgrade,
                    flyingSwords,
                    groups,
                );
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
        .add(FlyingSwordPiercingSequenceType)
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
            actions,
            stamina,
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
        } else if (upgrade === RogueUpgrade.FusionPower) {
            actions[SwordBodyUnity.Damage][0] *= 1.3;
        } else if (upgrade === RogueUpgrade.FusionEfficiency) {
            stamina[PlayerStamina.DrainPerSecond][0] = Math.max(
                MINIMUM_FUSION_STAMINA_DRAIN,
                stamina[PlayerStamina.DrainPerSecond][0] * 0.85,
            );
        } else if (upgrade === RogueUpgrade.FusionEndurance) {
            stamina[PlayerStamina.Maximum][0] += 20;
            stamina[PlayerStamina.Current][0] = Math.min(
                stamina[PlayerStamina.Maximum][0],
                stamina[PlayerStamina.Current][0] + 20,
            );
            stamina[PlayerStamina.RecoveryPerSecond][0] *= 1.1;
        }
        return;
    }
}

function applyUpgradeToSwordGroup(
    upgrade: number,
    flyingSwords: FlyingSwordService,
    groups: AutoGroups,
): void {
    const iter = groups.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            auto,
            lightning,
            metal,
            fire,
            cold,
        ] =
            iter.current;
        if (count === 0) continue;
        const formationRadii =
            auto[AutoFlyingSwordSkill.FormationRadius];
        const formationAngularSpeeds =
            auto[AutoFlyingSwordSkill.FormationAngularSpeed];
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
        } else if (upgrade === RogueUpgrade.ScatterRange) {
            auto[AutoFlyingSwordSkill.TargetRadius][0] *= 1.2;
        } else if (upgrade === RogueUpgrade.FocusPower) {
            auto[AutoFlyingSwordSkill.FocusDamageMultiplier][0] *= 1.35;
        } else if (upgrade === RogueUpgrade.FormationPower) {
            auto[AutoFlyingSwordSkill.FormationDamageMultiplier][0] *=
                1.25;
        } else if (upgrade === RogueUpgrade.FormationTempo) {
            formationAngularSpeeds[0] *= 1.15;
            auto[
                AutoFlyingSwordSkill.FormationContactCooldownTicks
            ][0] = Math.max(
                MINIMUM_FORMATION_CONTACT_COOLDOWN_TICKS,
                Math.floor(
                    auto[
                        AutoFlyingSwordSkill
                            .FormationContactCooldownTicks
                    ][0] * 0.85,
                ),
            );
            flyingSwords.setFormationTuning(
                entities[0],
                formationRadii[0],
                formationAngularSpeeds[0],
            );
        } else if (upgrade === RogueUpgrade.FormationRange) {
            formationRadii[0] *= 1.18;
            flyingSwords.setFormationTuning(
                entities[0],
                formationRadii[0],
                formationAngularSpeeds[0],
            );
        } else if (upgrade === RogueUpgrade.LightningIntent) {
            const chainCounts =
                lightning[LightningSwordIntent.ChainCount];
            const damageMultipliers =
                lightning[LightningSwordIntent.DamageMultiplier];
            if (chainCounts[0] === 0) {
                chainCounts[0] = 1;
            } else {
                damageMultipliers[0] *= 1.2;
            }
        } else if (upgrade === RogueUpgrade.MetalIntent) {
            const maximumMomentum =
                metal[MetalSwordIntent.MaximumMomentum];
            const damagePerMomentum =
                metal[MetalSwordIntent.DamagePerMomentum];
            if (maximumMomentum[0] === 0) {
                maximumMomentum[0] = 4;
            } else {
                damagePerMomentum[0] *= 1.2;
            }
        } else if (upgrade === RogueUpgrade.FireIntent) {
            const burstThresholds =
                fire[FireSwordIntent.BurstThreshold];
            const burstDamageMultipliers =
                fire[FireSwordIntent.BurstDamageMultiplier];
            if (burstThresholds[0] === 0) {
                burstThresholds[0] = 4;
            } else {
                burstDamageMultipliers[0] *= 1.2;
            }
        } else if (upgrade === RogueUpgrade.ColdIntent) {
            const maximumStacks =
                cold[ColdSwordIntent.MaximumStacks];
            const slowPerStack =
                cold[ColdSwordIntent.SlowPerStack];
            if (maximumStacks[0] === 0) {
                maximumStacks[0] = 5;
            } else {
                slowPerStack[0] *= 1.15;
            }
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
    enemies: EnemyIntents,
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
        const [count, , velocities, motion, locomotion] =
            iter.current;
        const velocityXs = velocities[Float3.X];
        const velocityYs = velocities[Float3.Y];
        const velocityZs = velocities[Float3.Z];
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        const maximumSpeeds = motion[MoveTowards3.MaximumSpeed];
        const baseSpeeds =
            locomotion[EnemyLocomotion.BaseSpeed];
        const baseAccelerations =
            locomotion[EnemyLocomotion.BaseAcceleration];
        const desiredSpeeds =
            locomotion[EnemyLocomotion.DesiredSpeed];
        const desiredAccelerations =
            locomotion[EnemyLocomotion.DesiredAcceleration];
        for (let row = 0; row < count; row++) {
            if (!playing) {
                desiredSpeeds[row] = 0;
                desiredAccelerations[row] = baseAccelerations[row];
                maximumSpeeds[row] = 0;
                velocityXs[row] = 0;
                velocityYs[row] = 0;
                velocityZs[row] = 0;
                continue;
            }
            desiredSpeeds[row] = baseSpeeds[row];
            desiredAccelerations[row] = baseAccelerations[row];
            targetXs[row] = playerX;
            targetYs[row] = playerY;
            targetZs[row] = playerZ;
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
    time: Readonly<TimeState>,
    scratch: Mut<RogueEntityAccessState>,
    requests: DamageRequests,
): void {
    const component = world.findComponent(HealthType);
    if (!component) return;
    const componentId = component.id;
    const feedbackId = world.findComponent(EnemyFeedbackType)?.id;
    const access = scratch.access;
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const targets = data[DamageRequest.Target];
        const amounts = data[DamageRequest.Amount];
        const kinds = data[DamageRequest.Kind];
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
                    const amount = Math.max(0, amounts[row]);
                    current[localRow] = Math.max(
                        0,
                        current[localRow] - amount,
                    );
                    if (amount > 0 && feedbackId !== undefined) {
                        const feedback = access.archetype.getComp(
                            access.row,
                            feedbackId,
                        ) as ComponentColumns<EnemyFeedbackType> | null;
                        if (feedback) {
                            feedback[EnemyFeedback.HitFlashEndTick][
                                localRow
                            ] = time.tick +
                                hitFlashTicks(kinds[row]);
                            feedback[EnemyFeedback.HitKind][localRow] =
                                kinds[row];
                        }
                    }
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

export {
    progressAlongSegment3,
    squaredDistanceToSegment3,
} from
    "./flying-sword/combat-spatial-index";

export function rogueRequiredExperienceFor(level: number): number {
    return Math.round(8 + 5 * Math.pow(level, 1.35));
}

const PLAYER_MOVEMENT_ACCELERATION = 48;
const PLAYER_MOVEMENT_ARRIVAL_RADIUS = 0.04;
const PLAYER_RADIUS = 0.48;
const MAX_FLYING_SWORD_UPGRADE_COUNT = 49;

function hitFlashTicks(kind: number): number {
    return HIT_FLASH_TICKS_BY_KIND[kind] ??
        GENERIC_HIT_FLASH_TICKS;
}

const GENERIC_HIT_FLASH_TICKS = 5;
const SCATTER_HIT_FLASH_TICKS = 4;
const FOCUS_HIT_FLASH_TICKS = 6;
const FORMATION_HIT_FLASH_TICKS = 3;
const FUSION_HIT_FLASH_TICKS = 8;
const LIGHTNING_HIT_FLASH_TICKS = 7;
const METAL_BREAK_HIT_FLASH_TICKS = 7;
const FIRE_BURST_HIT_FLASH_TICKS = 8;
const HIT_FLASH_TICKS_BY_KIND: Readonly<Record<number, number>> =
    Object.freeze({
        [DamageKind.Generic]: GENERIC_HIT_FLASH_TICKS,
        [DamageKind.ScatterSword]: SCATTER_HIT_FLASH_TICKS,
        [DamageKind.FocusSword]: FOCUS_HIT_FLASH_TICKS,
        [DamageKind.FormationSword]: FORMATION_HIT_FLASH_TICKS,
        [DamageKind.SwordBodyUnity]: FUSION_HIT_FLASH_TICKS,
        [DamageKind.LightningChain]: LIGHTNING_HIT_FLASH_TICKS,
        [DamageKind.MetalBreak]: METAL_BREAK_HIT_FLASH_TICKS,
        [DamageKind.FireBurst]: FIRE_BURST_HIT_FLASH_TICKS,
    });
const MINIMUM_FORMATION_CONTACT_COOLDOWN_TICKS = 2;
const MINIMUM_FUSION_STAMINA_DRAIN = 10;
