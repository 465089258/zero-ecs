import {
    Update,
    Write,
    defSystem,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import { FlyingSwordSkillCatalog } from "../skill-catalog";
import { FlyingSwordSystemSet } from "../system-set";
import { FlyingSwordSkillPhase } from "../skill-types";
import { FlyingSwordField } from "../types";
import { FlyingSwordRuntimeState } from "./runtime-state";
import { FlyingSwordStorageQuery } from "./queries";
import { FlyingSwordSkillActionState } from "./skill-action-state";
import {
    FlyingSwordSkillRequestKind,
    FlyingSwordSkillRequestState,
} from "./skill-request-state";

type Swords = QueryOf<typeof FlyingSwordStorageQuery>;

export const applyFlyingSwordSkillRequestsSystem = defSystem(
    Update.fixed,
    applyFlyingSwordSkillRequests,
    [
        TimeState,
        FlyingSwordSkillCatalog,
        Write(FlyingSwordSkillRequestState),
        Write(FlyingSwordSkillActionState),
    ],
);

export const acquireFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    acquireFlyingSwordSkills,
    [
        FlyingSwordSkillCatalog,
        Write(FlyingSwordSkillActionState),
        FlyingSwordStorageQuery,
    ],
);

export const guideFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    guideFlyingSwordSkills,
    [
        TimeState,
        FlyingSwordSkillCatalog,
        FlyingSwordSkillActionState,
        FlyingSwordRuntimeState,
        FlyingSwordStorageQuery,
    ],
);

export const resolveFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    resolveFlyingSwordSkills,
    [
        TimeState,
        FlyingSwordSkillCatalog,
        Write(FlyingSwordSkillActionState),
        FlyingSwordStorageQuery,
    ],
);

export const cleanupFlyingSwordSkillsSystem = defSystem(
    Update.fixed,
    cleanupFlyingSwordSkills,
    [TimeState, Write(FlyingSwordSkillActionState)],
);

export const FlyingSwordSkillSystemOptions = Object.freeze({
    requests: {
        inSet: FlyingSwordSystemSet.Request,
    } as const,
    acquire: {
        inSet: FlyingSwordSystemSet.Skill,
        after: FlyingSwordSystemSet.Control,
    } as const,
    guidance: {
        inSet: FlyingSwordSystemSet.Guidance,
        after: FlyingSwordSystemSet.Formation,
    } as const,
    contact: {
        inSet: FlyingSwordSystemSet.Contact,
        after: FlyingSwordSystemSet.Motion,
    } as const,
    cleanup: {
        inSet: FlyingSwordSystemSet.Cleanup,
        after: FlyingSwordSystemSet.Contact,
    } as const,
});

function applyFlyingSwordSkillRequests(
    time: Readonly<TimeState>,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    requests: Mut<FlyingSwordSkillRequestState>,
    actions: Mut<FlyingSwordSkillActionState>,
): void {
    for (let request = 0; request < requests.count; request++) {
        const group = requests.groups[request];
        if (requests.kinds[request] === FlyingSwordSkillRequestKind.Activate) {
            const planId = requests.planIds[request];
            catalog.require(planId);
            actions.activate(
                group,
                planId,
                requests.targetXs[request],
                requests.targetYs[request],
                requests.targetZs[request],
                time.tick,
            );
        } else {
            actions.requestReturn(group, time.tick);
        }
    }
    requests.clear();
}

function acquireFlyingSwordSkills(
    catalog: Readonly<FlyingSwordSkillCatalog>,
    actions: Mut<FlyingSwordSkillActionState>,
    swords: Swords,
): void {
    let pending = 0;
    for (let action = 0; action < actions.count; action++) {
        if (actions.acquired[action] !== 0) continue;
        actions.reservedCounts[action] = 0;
        actions.remainingCounts[action] = 0;
        pending++;
    }
    if (pending === 0) return;

    const iter = swords.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        const groups = data[FlyingSwordField.Group];
        const sequences = data[FlyingSwordField.ActionSequence];
        const phases = data[FlyingSwordField.ActionPhase];
        const phaseStartTicks =
            data[FlyingSwordField.ActionPhaseStartTick];
        const roles = data[FlyingSwordField.ActionRole];
        const contactActive = data[FlyingSwordField.ContactActive];
        for (let row = 0; row < count; row++) {
            const action = actions.indices.get(groups[row]);
            if (action === undefined || actions.acquired[action] !== 0) {
                continue;
            }
            const sequence = actions.sequences[action];
            if (sequences[row] !== 0 && sequences[row] !== sequence) continue;
            const plan = catalog.require(actions.planIds[action]);
            const role = actions.reservedCounts[action];
            if (role >= plan.maximumSwords) {
                if (sequences[row] === sequence) releaseSword(
                    sequences,
                    phases,
                    phaseStartTicks,
                    roles,
                    contactActive,
                    row,
                );
                continue;
            }
            sequences[row] = sequence;
            phases[row] = FlyingSwordSkillPhase.Gather;
            phaseStartTicks[row] = actions.startTicks[action];
            roles[row] = role;
            contactActive[row] = 0;
            actions.reservedCounts[action] = role + 1;
        }
    }

    for (let action = 0; action < actions.count; action++) {
        if (actions.acquired[action] !== 0) continue;
        const reserved = actions.reservedCounts[action];
        const plan = catalog.require(actions.planIds[action]);
        actions.acquired[action] = 1;
        actions.remainingCounts[action] = reserved;
        if (reserved < plan.minimumSwords) {
            actions.stages[action] = FlyingSwordSkillPhase.Return;
            actions.displayPhases[action] = FlyingSwordSkillPhase.Return;
        }
    }
}

function guideFlyingSwordSkills(
    time: Readonly<TimeState>,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    actions: Readonly<FlyingSwordSkillActionState>,
    runtime: Readonly<FlyingSwordRuntimeState>,
    swords: Swords,
): void {
    if (actions.count === 0) return;
    const iter = swords.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        const groups = data[FlyingSwordField.Group];
        const formationGoalXs = data[FlyingSwordField.FormationGoalX];
        const formationGoalYs = data[FlyingSwordField.FormationGoalY];
        const formationGoalZs = data[FlyingSwordField.FormationGoalZ];
        const goalXs = data[FlyingSwordField.GoalX];
        const goalYs = data[FlyingSwordField.GoalY];
        const goalZs = data[FlyingSwordField.GoalZ];
        const arrivalRadii = data[FlyingSwordField.ArrivalRadius];
        const speedMultipliers = data[FlyingSwordField.SpeedMultiplier];
        const accelerationMultipliers =
            data[FlyingSwordField.AccelerationMultiplier];
        const sequences = data[FlyingSwordField.ActionSequence];
        const phases = data[FlyingSwordField.ActionPhase];
        const phaseStartTicks =
            data[FlyingSwordField.ActionPhaseStartTick];
        const roles = data[FlyingSwordField.ActionRole];
        const contactActive = data[FlyingSwordField.ContactActive];

        let cachedAction = -1;
        let cachedPlan = catalog.require(actions.planIds[0]);
        let cachedCenterX = 0;
        let cachedCenterY = 0;
        let cachedCenterZ = 0;
        let cachedTargetX = 0;
        let cachedTargetY = 0;
        let cachedTargetZ = 0;
        let directionX = 0;
        let directionZ = 1;
        let rightX = 1;
        let rightZ = 0;
        let columns = 1;
        let reserved = 1;
        let stage: number = FlyingSwordSkillPhase.Gather;
        let stageStartTick = 0;

        for (let row = 0; row < count; row++) {
            const sequence = sequences[row];
            if (sequence === 0) continue;
            const action = actions.indices.get(groups[row]);
            if (
                action === undefined ||
                actions.sequences[action] !== sequence
            ) {
                releaseSword(
                    sequences,
                    phases,
                    phaseStartTicks,
                    roles,
                    contactActive,
                    row,
                );
                continue;
            }
            if (action !== cachedAction) {
                const snapshot = runtime.groups.get(groups[row]);
                if (!snapshot || snapshot.tick !== time.tick) continue;
                cachedAction = action;
                cachedPlan = catalog.require(actions.planIds[action]);
                cachedCenterX = snapshot.centerX;
                cachedCenterY = snapshot.centerY;
                cachedCenterZ = snapshot.centerZ;
                cachedTargetX = actions.targetXs[action];
                cachedTargetY = actions.targetYs[action];
                cachedTargetZ = actions.targetZs[action];
                const dx = cachedTargetX - cachedCenterX;
                const dz = cachedTargetZ - cachedCenterZ;
                const length = Math.sqrt(dx * dx + dz * dz);
                if (length > 1e-6) {
                    directionX = dx / length;
                    directionZ = dz / length;
                } else {
                    directionX = 0;
                    directionZ = 1;
                }
                rightX = directionZ;
                rightZ = -directionX;
                reserved = Math.max(1, actions.reservedCounts[action]);
                columns = Math.max(1, Math.ceil(Math.sqrt(reserved)));
                stage = actions.stages[action];
                stageStartTick = actions.phaseStartTicks[action];
            }

            const role = roles[row];
            if (stage === FlyingSwordSkillPhase.Return) {
                if (phases[row] !== FlyingSwordSkillPhase.Rejoin) {
                    phases[row] = FlyingSwordSkillPhase.Return;
                    phaseStartTicks[row] = stageStartTick;
                }
                writeReturnGoal(
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    goalXs,
                    goalYs,
                    goalZs,
                    arrivalRadii,
                    speedMultipliers,
                    accelerationMultipliers,
                    contactActive,
                    row,
                    cachedPlan.returnSpeedMultiplier,
                    cachedPlan.rejoinRadius,
                );
                continue;
            }

            if (stage === FlyingSwordSkillPhase.Gather) {
                phases[row] = FlyingSwordSkillPhase.Gather;
                writeGatherGoal(
                    cachedPlan.gatherDistance,
                    cachedPlan.gatherHeight,
                    cachedPlan.gatherSpacing,
                    cachedPlan.gatherArrivalRadius,
                    cachedPlan.gatherSpeedMultiplier,
                    cachedCenterX,
                    cachedCenterY,
                    cachedCenterZ,
                    directionX,
                    directionZ,
                    rightX,
                    rightZ,
                    columns,
                    reserved,
                    role,
                    goalXs,
                    goalYs,
                    goalZs,
                    arrivalRadii,
                    speedMultipliers,
                    accelerationMultipliers,
                    contactActive,
                    row,
                );
                continue;
            }

            if (phases[row] === FlyingSwordSkillPhase.Gather) {
                phases[row] = FlyingSwordSkillPhase.Launch;
                phaseStartTicks[row] = stageStartTick +
                    role % cachedPlan.launchWaveCount *
                    cachedPlan.launchIntervalTicks;
            }
            const phase = phases[row];
            if (
                phase === FlyingSwordSkillPhase.Launch &&
                time.tick < phaseStartTicks[row]
            ) {
                writeGatherGoal(
                    cachedPlan.gatherDistance,
                    cachedPlan.gatherHeight,
                    cachedPlan.gatherSpacing,
                    cachedPlan.gatherArrivalRadius,
                    cachedPlan.gatherSpeedMultiplier,
                    cachedCenterX,
                    cachedCenterY,
                    cachedCenterZ,
                    directionX,
                    directionZ,
                    rightX,
                    rightZ,
                    columns,
                    reserved,
                    role,
                    goalXs,
                    goalYs,
                    goalZs,
                    arrivalRadii,
                    speedMultipliers,
                    accelerationMultipliers,
                    contactActive,
                    row,
                );
            } else if (phase === FlyingSwordSkillPhase.Launch) {
                const lateral = strikeLateral(
                    role,
                    reserved,
                    cachedPlan.strikeSpread,
                );
                goalXs[row] = cachedTargetX + rightX * lateral;
                goalYs[row] = cachedTargetY + cachedPlan.strikeHeight;
                goalZs[row] = cachedTargetZ + rightZ * lateral;
                arrivalRadii[row] = SKILL_TARGET_ARRIVAL_RADIUS;
                speedMultipliers[row] =
                    cachedPlan.launchSpeedMultiplier;
                accelerationMultipliers[row] =
                    cachedPlan.launchSpeedMultiplier;
                contactActive[row] = 1;
            } else if (phase === FlyingSwordSkillPhase.Strike) {
                const lateral = strikeLateral(
                    role,
                    reserved,
                    cachedPlan.strikeSpread,
                );
                goalXs[row] =
                    cachedTargetX +
                    directionX * cachedPlan.passDistance +
                    rightX * lateral;
                goalYs[row] = cachedTargetY + cachedPlan.strikeHeight;
                goalZs[row] =
                    cachedTargetZ +
                    directionZ * cachedPlan.passDistance +
                    rightZ * lateral;
                arrivalRadii[row] = SKILL_TARGET_ARRIVAL_RADIUS;
                speedMultipliers[row] =
                    cachedPlan.strikeSpeedMultiplier;
                accelerationMultipliers[row] =
                    cachedPlan.strikeSpeedMultiplier;
                contactActive[row] = 1;
            } else {
                writeReturnGoal(
                    formationGoalXs,
                    formationGoalYs,
                    formationGoalZs,
                    goalXs,
                    goalYs,
                    goalZs,
                    arrivalRadii,
                    speedMultipliers,
                    accelerationMultipliers,
                    contactActive,
                    row,
                    cachedPlan.returnSpeedMultiplier,
                    cachedPlan.rejoinRadius,
                );
            }
        }
    }
}

function resolveFlyingSwordSkills(
    time: Readonly<TimeState>,
    catalog: Readonly<FlyingSwordSkillCatalog>,
    actions: Mut<FlyingSwordSkillActionState>,
    swords: Swords,
): void {
    if (actions.count === 0) return;
    for (let action = 0; action < actions.count; action++) {
        actions.remainingCounts[action] = 0;
        actions.gatherArrivedCounts[action] = 0;
        actions.observedMaximumPhases[action] =
            FlyingSwordSkillPhase.Gather;
        const plan = catalog.require(actions.planIds[action]);
        if (
            actions.stages[action] !== FlyingSwordSkillPhase.Return &&
            time.tick - actions.startTicks[action] >=
            plan.actionTimeoutTicks
        ) {
            actions.stages[action] = FlyingSwordSkillPhase.Return;
            actions.displayPhases[action] = FlyingSwordSkillPhase.Return;
            actions.phaseStartTicks[action] = time.tick;
        }
    }

    const iter = swords.iter();
    while (iter.next()) {
        const [count, , data] = iter.current;
        const groups = data[FlyingSwordField.Group];
        const xs = data[FlyingSwordField.X];
        const ys = data[FlyingSwordField.Y];
        const zs = data[FlyingSwordField.Z];
        const goalXs = data[FlyingSwordField.GoalX];
        const goalYs = data[FlyingSwordField.GoalY];
        const goalZs = data[FlyingSwordField.GoalZ];
        const arrivalRadii = data[FlyingSwordField.ArrivalRadius];
        const sequences = data[FlyingSwordField.ActionSequence];
        const phases = data[FlyingSwordField.ActionPhase];
        const phaseStartTicks =
            data[FlyingSwordField.ActionPhaseStartTick];
        const roles = data[FlyingSwordField.ActionRole];
        const contactActive = data[FlyingSwordField.ContactActive];
        for (let row = 0; row < count; row++) {
            const sequence = sequences[row];
            if (sequence === 0) continue;
            const action = actions.indices.get(groups[row]);
            if (
                action === undefined ||
                actions.sequences[action] !== sequence
            ) {
                releaseSword(
                    sequences,
                    phases,
                    phaseStartTicks,
                    roles,
                    contactActive,
                    row,
                );
                continue;
            }
            const plan = catalog.require(actions.planIds[action]);
            const dx = goalXs[row] - xs[row];
            const dy = goalYs[row] - ys[row];
            const dz = goalZs[row] - zs[row];
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            const arrived =
                distanceSquared <= arrivalRadii[row] * arrivalRadii[row];

            if (
                actions.stages[action] ===
                FlyingSwordSkillPhase.Gather
            ) {
                actions.remainingCounts[action]++;
                if (arrived) actions.gatherArrivedCounts[action]++;
                continue;
            }

            if (
                actions.stages[action] ===
                FlyingSwordSkillPhase.Return &&
                phases[row] !== FlyingSwordSkillPhase.Rejoin
            ) {
                phases[row] = FlyingSwordSkillPhase.Return;
                phaseStartTicks[row] = time.tick;
            }

            let phase = phases[row];
            if (
                phase === FlyingSwordSkillPhase.Launch &&
                time.tick >= phaseStartTicks[row]
            ) {
                if (arrived) {
                    phase = FlyingSwordSkillPhase.Strike;
                    phases[row] = phase;
                    phaseStartTicks[row] = time.tick;
                } else if (
                    time.tick - phaseStartTicks[row] >=
                    plan.launchTimeoutTicks
                ) {
                    phase = FlyingSwordSkillPhase.Return;
                    phases[row] = phase;
                    phaseStartTicks[row] = time.tick;
                }
            } else if (phase === FlyingSwordSkillPhase.Strike) {
                if (
                    arrived ||
                    time.tick - phaseStartTicks[row] >= plan.strikeTicks
                ) {
                    phase = FlyingSwordSkillPhase.Return;
                    phases[row] = phase;
                    phaseStartTicks[row] = time.tick;
                }
            } else if (phase === FlyingSwordSkillPhase.Return) {
                if (arrived) {
                    phase = FlyingSwordSkillPhase.Rejoin;
                    phases[row] = phase;
                    phaseStartTicks[row] = time.tick;
                }
            } else if (phase === FlyingSwordSkillPhase.Rejoin) {
                if (
                    time.tick - phaseStartTicks[row] >= plan.rejoinTicks
                ) {
                    releaseSword(
                        sequences,
                        phases,
                        phaseStartTicks,
                        roles,
                        contactActive,
                        row,
                    );
                    continue;
                }
            }
            actions.remainingCounts[action]++;
            actions.observedMaximumPhases[action] = Math.max(
                actions.observedMaximumPhases[action],
                phase,
            );
        }
    }

    for (let action = 0; action < actions.count; action++) {
        const plan = catalog.require(actions.planIds[action]);
        if (
            actions.stages[action] === FlyingSwordSkillPhase.Gather
        ) {
            const reserved = actions.reservedCounts[action];
            if (
                reserved > 0 &&
                (
                    actions.gatherArrivedCounts[action] / reserved >=
                    plan.gatherArrivalRatio ||
                    time.tick - actions.startTicks[action] >= plan.gatherTicks
                )
            ) {
                actions.stages[action] = FlyingSwordSkillPhase.Launch;
                actions.displayPhases[action] =
                    FlyingSwordSkillPhase.Launch;
                actions.phaseStartTicks[action] = time.tick;
            } else {
                actions.displayPhases[action] =
                    FlyingSwordSkillPhase.Gather;
            }
        } else if (actions.remainingCounts[action] > 0) {
            actions.displayPhases[action] =
                actions.observedMaximumPhases[action];
        } else {
            if (
                actions.displayPhases[action] !==
                FlyingSwordSkillPhase.Rejoin
            ) {
                actions.displayPhases[action] =
                    FlyingSwordSkillPhase.Rejoin;
                actions.phaseStartTicks[action] = time.tick;
            }
        }
    }
}

function cleanupFlyingSwordSkills(
    time: Readonly<TimeState>,
    actions: Mut<FlyingSwordSkillActionState>,
): void {
    for (let action = actions.count - 1; action >= 0; action--) {
        if (
            actions.acquired[action] !== 0 &&
            actions.remainingCounts[action] === 0 &&
            actions.displayPhases[action] ===
                FlyingSwordSkillPhase.Rejoin &&
            time.tick > actions.phaseStartTicks[action]
        ) {
            actions.remove(action);
        }
    }
}

function writeGatherGoal(
    gatherDistance: number,
    gatherHeight: number,
    gatherSpacing: number,
    gatherArrivalRadius: number,
    gatherSpeedMultiplier: number,
    centerX: number,
    centerY: number,
    centerZ: number,
    directionX: number,
    directionZ: number,
    rightX: number,
    rightZ: number,
    columns: number,
    reserved: number,
    role: number,
    goalXs: Float32Array,
    goalYs: Float32Array,
    goalZs: Float32Array,
    arrivalRadii: Float32Array,
    speedMultipliers: Float32Array,
    accelerationMultipliers: Float32Array,
    contactActive: Uint8Array,
    row: number,
): void {
    const gatherRow = Math.floor(role / columns);
    const rowStart = gatherRow * columns;
    const rowCount = Math.min(columns, reserved - rowStart);
    const column = role - rowStart;
    const rows = Math.ceil(reserved / columns);
    const lateral = (column - (rowCount - 1) * 0.5) * gatherSpacing;
    const longitudinal =
        (gatherRow - (rows - 1) * 0.5) * gatherSpacing;
    const depth = gatherDistance + longitudinal;
    goalXs[row] = centerX - directionX * depth + rightX * lateral;
    goalYs[row] =
        centerY + gatherHeight + gatherRow % 3 * gatherSpacing * 0.18;
    goalZs[row] = centerZ - directionZ * depth + rightZ * lateral;
    arrivalRadii[row] = gatherArrivalRadius;
    speedMultipliers[row] = gatherSpeedMultiplier;
    accelerationMultipliers[row] = gatherSpeedMultiplier;
    contactActive[row] = 0;
}

function writeReturnGoal(
    formationGoalXs: Float32Array,
    formationGoalYs: Float32Array,
    formationGoalZs: Float32Array,
    goalXs: Float32Array,
    goalYs: Float32Array,
    goalZs: Float32Array,
    arrivalRadii: Float32Array,
    speedMultipliers: Float32Array,
    accelerationMultipliers: Float32Array,
    contactActive: Uint8Array,
    row: number,
    speedMultiplier: number,
    rejoinRadius: number,
): void {
    goalXs[row] = formationGoalXs[row];
    goalYs[row] = formationGoalYs[row];
    goalZs[row] = formationGoalZs[row];
    arrivalRadii[row] = rejoinRadius;
    speedMultipliers[row] = speedMultiplier;
    accelerationMultipliers[row] = speedMultiplier;
    contactActive[row] = 0;
}

function releaseSword(
    sequences: Uint32Array,
    phases: Uint8Array,
    phaseStartTicks: Uint32Array,
    roles: Uint16Array,
    contactActive: Uint8Array,
    row: number,
): void {
    sequences[row] = 0;
    phases[row] = FlyingSwordSkillPhase.Idle;
    phaseStartTicks[row] = 0;
    roles[row] = 0;
    contactActive[row] = 0;
}

function strikeLateral(
    role: number,
    reserved: number,
    spread: number,
): number {
    if (reserved <= 1) return 0;
    return (role / (reserved - 1) - 0.5) * spread;
}

const SKILL_TARGET_ARRIVAL_RADIUS = 0.62;
