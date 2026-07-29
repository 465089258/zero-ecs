import {
    Commands,
    QueryType,
    Update,
    World,
    Write,
    With,
    defSystem,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    ControlledFlyingSwordTag,
    FlyingSwordBehavior,
    FlyingSwordControlAssignment,
    FlyingSwordControlAssignmentType,
    FlyingSwordGroupQuery,
    FlyingSwordFormation,
    FlyingSwordMember,
    FlyingSwordMode,
    FlyingSwordService,
    FlyingSwordStance,
    FlyingSwordSystemSet,
    FlyingSwordView,
    PendingFlyingSwordRetireTag,
    ReserveFlyingSwordTag,
} from "../../../domain/flying-sword";
import {
    FlyingSwordSkillActionStorage,
    FlyingSwordTaskStorage,
} from "../../../domain/flying-sword/runtime/storage";
import {
    Direction3Type,
    Float3,
    Position3Type,
} from "../../../infrastructure/math";
import {
    MotionSystemSet,
    MoveTowards3,
    MoveTowards3Type,
} from "../../../infrastructure/motion";
import { CultivatorTag } from "../../components";
import { DemoSceneState } from "../../state";
import {
    ContainedSword,
    ContainedSwordType,
    FormationFlyingSwordTag,
    PlayerMana,
    PlayerManaType,
    SpiritualSense,
    SpiritualSenseType,
    SwordSpiritPower,
    SwordSpiritPowerType,
} from "../components";

const ControlledSwordResourceQuery = QueryType.from(With(
    FlyingSwordView,
    ControlledFlyingSwordTag,
    FlyingSwordControlAssignmentType,
    ContainedSwordType,
    SwordSpiritPowerType,
));

const ReserveSwordResourceQuery = QueryType.from(With(
    FlyingSwordView,
    ReserveFlyingSwordTag,
    ContainedSwordType,
    SwordSpiritPowerType,
));

const ReserveSwordMotionQuery = QueryType.from(With(
    FlyingSwordView,
    ReserveFlyingSwordTag,
    ContainedSwordType,
    SwordSpiritPowerType,
    Position3Type,
    Direction3Type,
    MoveTowards3Type,
));

const ManaPlayerQuery = QueryType.from(With(
    CultivatorTag,
    PlayerManaType,
    SpiritualSenseType,
));

const ReserveOwnerDirectionQuery = QueryType.from(With(
    CultivatorTag,
    Direction3Type,
));

type ControlledSwords = QueryOf<typeof ControlledSwordResourceQuery>;
type ReserveSwords = QueryOf<typeof ReserveSwordResourceQuery>;
type ReserveMotion = QueryOf<typeof ReserveSwordMotionQuery>;
type ManaPlayers = QueryOf<typeof ManaPlayerQuery>;
type ReserveOwners = QueryOf<typeof ReserveOwnerDirectionQuery>;
type Groups = QueryOf<typeof FlyingSwordGroupQuery>;

export const updateSwordResourcesSystem = defSystem(
    Update.fixed,
    updateSwordResources,
    [
        Commands,
        World,
        TimeState,
        FlyingSwordService,
        Write(DemoSceneState),
        ControlledSwordResourceQuery,
        ReserveSwordResourceQuery,
        ManaPlayerQuery,
        FlyingSwordGroupQuery,
    ],
);

export const guideReserveSwordFanSystem = defSystem(
    Update.fixed,
    guideReserveSwordFan,
    [
        TimeState,
        ReserveSwordMotionQuery,
        FlyingSwordGroupQuery,
        ReserveOwnerDirectionQuery,
    ],
);

export const orientReserveSwordFanSystem = defSystem(
    Update.fixed,
    orientReserveSwordFan,
    [
        TimeState,
        ReserveSwordMotionQuery,
        ReserveOwnerDirectionQuery,
    ],
);

export const SwordLoadoutSystemOptions = Object.freeze({
    resources: {
        before: FlyingSwordSystemSet.Request,
    },
    reserveFan: {
        after: FlyingSwordSystemSet.Formation,
        before: MotionSystemSet.Integrate3,
    },
    reserveOrientation: {
        after: MotionSystemSet.Integrate3,
    },
});

function updateSwordResources(
    commands: Commands,
    world: World,
    time: Readonly<TimeState>,
    flyingSwords: FlyingSwordService,
    scene: Mut<DemoSceneState>,
    controlled: ControlledSwords,
    reserves: ReserveSwords,
    players: ManaPlayers,
    groups: Groups,
): void {
    const tick = time.tick;
    const delta = time.delta;
    let formationGroup = 0 as Entity;
    let formationActive = false;
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [count, entities, , , , , , behaviors] =
            groupIter.current;
        const stances = behaviors[FlyingSwordBehavior.Stance];
        for (let row = 0; row < count; row++) {
            if (stances[row] === FlyingSwordStance.Formation) {
                formationGroup = entities[row];
                formationActive = true;
                break;
            }
        }
        if (formationActive) break;
    }

    let controlledCount = 0;
    let controlLimit = 0;
    const controlledIter = controlled.iter();
    while (controlledIter.next()) {
        const [count, entities, members, , , , spirits] =
            controlledIter.current;
        const swordGroups = members[FlyingSwordMember.Group];
        const currents = spirits[SwordSpiritPower.Current];
        const recoveryStarts =
            spirits[SwordSpiritPower.RecoveryStartTick];
        for (let row = 0; row < count; row++) {
            controlledCount++;
            const sword = entities[row];
            const inFormation =
                formationActive &&
                swordGroups[row] === formationGroup;
            if (inFormation) {
                currents[row] = Math.max(
                    0,
                    currents[row] -
                        FORMATION_SWORD_SPIRIT_DRAIN_PER_SECOND *
                        delta,
                );
                if (!world.has(sword, FormationFlyingSwordTag)) {
                    commands
                        .entity(sword)
                        .add(FormationFlyingSwordTag)
                        .submit();
                }
            } else if (world.has(sword, FormationFlyingSwordTag)) {
                commands
                    .entity(sword)
                    .remove(FormationFlyingSwordTag)
                    .submit();
            }
            if (currents[row] <= 0) {
                recoveryStarts[row] = tick + SPIRIT_RECOVERY_DELAY_TICKS;
            }
        }
    }

    const playerIter = players.iter();
    while (playerIter.next()) {
        const [count, , , mana, spiritual] = playerIter.current;
        if (count === 0) continue;
        controlLimit =
            spiritual[SpiritualSense.Base][0] +
            spiritual[SpiritualSense.Bonus][0];
        const currents = mana[PlayerMana.Current];
        const maximums = mana[PlayerMana.Maximum];
        if (formationActive) {
            const drain =
                mana[PlayerMana.FormationBaseDrainPerSecond][0] +
                mana[
                    PlayerMana.FormationDrainPerSwordPerSecond
                ][0] * controlledCount;
            currents[0] = Math.max(0, currents[0] - drain * delta);
            if (currents[0] <= 0) {
                flyingSwords.setStance(
                    formationGroup,
                    FlyingSwordStance.Scatter,
                );
                scene.stance = FlyingSwordStance.Scatter;
                scene.mode = FlyingSwordMode.Orbit;
            }
        } else {
            currents[0] = Math.min(
                maximums[0],
                currents[0] +
                    mana[PlayerMana.RecoveryPerSecond][0] * delta,
            );
        }
        break;
    }

    recoverReserveSwords(time, reserves);
    const rotated = rotateOneExhaustedSword(
        commands,
        world,
        tick,
        controlled,
        reserves,
    );
    if (!rotated && controlledCount < controlLimit) {
        promoteOneReserveSword(
            commands,
            flyingSwords,
            controlled,
            reserves,
            controlledCount,
        );
    }
}

function recoverReserveSwords(
    time: Readonly<TimeState>,
    reserves: ReserveSwords,
): void {
    const iter = reserves.iter();
    while (iter.next()) {
        const [count, , , , , spirits] = iter.current;
        const currents = spirits[SwordSpiritPower.Current];
        const maximums = spirits[SwordSpiritPower.Maximum];
        const recoveries = spirits[SwordSpiritPower.RecoveryPerSecond];
        const starts = spirits[SwordSpiritPower.RecoveryStartTick];
        for (let row = 0; row < count; row++) {
            if (time.tick < starts[row]) continue;
            currents[row] = Math.min(
                maximums[row],
                currents[row] + recoveries[row] * time.delta,
            );
        }
    }
}

function rotateOneExhaustedSword(
    commands: Commands,
    world: World,
    tick: number,
    controlled: ControlledSwords,
    reserves: ReserveSwords,
): boolean {
    let outgoing = 0 as Entity;
    let outgoingGroup = 0 as Entity;
    let controlSlot = 0;
    const controlledIter = controlled.iter();
    while (controlledIter.next()) {
        const [count, entities, members, , assignments, , spirits] =
            controlledIter.current;
        const groups = members[FlyingSwordMember.Group];
        const slots =
            assignments[FlyingSwordControlAssignment.Slot];
        const currents = spirits[SwordSpiritPower.Current];
        for (let row = 0; row < count; row++) {
            if (currents[row] > 0) continue;
            outgoing = entities[row];
            outgoingGroup = groups[row] as Entity;
            controlSlot = slots[row];
            break;
        }
        if (outgoing !== 0) break;
    }
    if (outgoing === 0) return false;

    if (
        world.has(outgoing, FlyingSwordTaskStorage) ||
        world.has(outgoing, FlyingSwordSkillActionStorage)
    ) {
        if (!world.has(outgoing, PendingFlyingSwordRetireTag)) {
            commands
                .entity(outgoing)
                .add(PendingFlyingSwordRetireTag)
                .submit();
        }
        return false;
    }

    let incoming = 0 as Entity;
    let bestRatio = -1;
    let bestInventorySlot = 0xffff;
    const reserveIter = reserves.iter();
    while (reserveIter.next()) {
        const [count, entities, members, , contained, spirits] =
            reserveIter.current;
        const groups = members[FlyingSwordMember.Group];
        const inventorySlots = contained[ContainedSword.InventorySlot];
        const currents = spirits[SwordSpiritPower.Current];
        const maximums = spirits[SwordSpiritPower.Maximum];
        for (let row = 0; row < count; row++) {
            if (groups[row] !== outgoingGroup) continue;
            const ratio = maximums[row] > 0
                ? currents[row] / maximums[row]
                : 0;
            if (ratio < RESERVE_ACTIVATION_RATIO) continue;
            if (
                ratio > bestRatio ||
                (
                    ratio === bestRatio &&
                    inventorySlots[row] < bestInventorySlot
                )
            ) {
                incoming = entities[row];
                bestRatio = ratio;
                bestInventorySlot = inventorySlots[row];
            }
        }
    }
    if (incoming === 0) {
        if (!world.has(outgoing, PendingFlyingSwordRetireTag)) {
            commands
                .entity(outgoing)
                .add(PendingFlyingSwordRetireTag)
                .submit();
        }
        return false;
    }

    const outgoingCommand = commands
        .entity(outgoing)
        .remove(ControlledFlyingSwordTag)
        .remove(FlyingSwordControlAssignmentType)
        .add(ReserveFlyingSwordTag);
    if (world.has(outgoing, FormationFlyingSwordTag)) {
        outgoingCommand.remove(FormationFlyingSwordTag);
    }
    if (world.has(outgoing, PendingFlyingSwordRetireTag)) {
        outgoingCommand.remove(PendingFlyingSwordRetireTag);
    }
    outgoingCommand.submit();

    commands
        .entity(incoming)
        .remove(ReserveFlyingSwordTag)
        .add(ControlledFlyingSwordTag)
        .add(FlyingSwordControlAssignmentType)
        .set(
            FlyingSwordControlAssignmentType,
            FlyingSwordControlAssignment.Slot,
            controlSlot,
        )
        .submit();
    return true;
}

function promoteOneReserveSword(
    commands: Commands,
    flyingSwords: FlyingSwordService,
    controlled: ControlledSwords,
    reserves: ReserveSwords,
    controlledCount: number,
): void {
    let group = 0 as Entity;
    let incoming = 0 as Entity;
    let bestRatio = -1;
    let bestInventorySlot = 0xffff;
    const reserveIter = reserves.iter();
    while (reserveIter.next()) {
        const [count, entities, members, , contained, spirits] =
            reserveIter.current;
        const groups = members[FlyingSwordMember.Group];
        const inventorySlots = contained[ContainedSword.InventorySlot];
        const currents = spirits[SwordSpiritPower.Current];
        const maximums = spirits[SwordSpiritPower.Maximum];
        for (let row = 0; row < count; row++) {
            const ratio = maximums[row] > 0
                ? currents[row] / maximums[row]
                : 0;
            if (
                ratio > bestRatio ||
                (
                    ratio === bestRatio &&
                    inventorySlots[row] < bestInventorySlot
                )
            ) {
                incoming = entities[row];
                group = groups[row] as Entity;
                bestRatio = ratio;
                bestInventorySlot = inventorySlots[row];
            }
        }
    }
    if (incoming === 0 || group === 0) return;

    let controlSlot = 0;
    while (isControlSlotUsed(controlled, group, controlSlot)) {
        controlSlot++;
    }
    commands
        .entity(incoming)
        .remove(ReserveFlyingSwordTag)
        .add(ControlledFlyingSwordTag)
        .add(FlyingSwordControlAssignmentType)
        .set(
            FlyingSwordControlAssignmentType,
            FlyingSwordControlAssignment.Slot,
            controlSlot,
        )
        .submit();
    flyingSwords.setFormationSize(group, controlledCount + 1);
}

function isControlSlotUsed(
    controlled: ControlledSwords,
    group: Entity,
    slot: number,
): boolean {
    const iter = controlled.iter();
    while (iter.next()) {
        const [count, , members, , assignments] = iter.current;
        const groups = members[FlyingSwordMember.Group];
        const slots = assignments[FlyingSwordControlAssignment.Slot];
        for (let row = 0; row < count; row++) {
            if (groups[row] === group && slots[row] === slot) {
                return true;
            }
        }
    }
    return false;
}

function guideReserveSwordFan(
    time: Readonly<TimeState>,
    reserves: ReserveMotion,
    groups: Groups,
    owners: ReserveOwners,
): void {
    let centerX = 0;
    let centerY = 0;
    let centerZ = 0;
    let radius = RECALL_MINIMUM_RADIUS;
    let height = RECALL_MINIMUM_HEIGHT;
    let verticalAmplitude = 0.35;
    let verticalSpeed = 1.2;
    const groupIter = groups.iter();
    while (groupIter.next()) {
        const [count, , , centers, , formation] = groupIter.current;
        if (count === 0) continue;
        centerX = centers[Float3.X][0];
        centerY = centers[Float3.Y][0];
        centerZ = centers[Float3.Z][0];
        radius = Math.min(
            RECALL_MAXIMUM_RADIUS,
            Math.max(
                RECALL_MINIMUM_RADIUS,
                formation[FlyingSwordFormation.OrbitRadius][0],
            ),
        );
        height = Math.max(
            RECALL_MINIMUM_HEIGHT,
            formation[FlyingSwordFormation.OrbitHeight][0] * 0.65,
        );
        verticalAmplitude =
            formation[FlyingSwordFormation.VerticalAmplitude][0];
        verticalSpeed =
            formation[FlyingSwordFormation.VerticalSpeed][0];
        break;
    }
    readOwnerForward(owners);
    const forwardX = ownerForward.x;
    const forwardZ = ownerForward.z;
    const backX = -forwardX;
    const backZ = -forwardZ;
    const reserveCount = countReserveSwords(reserves);
    let rank = 0;
    const iter = reserves.iter();
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
            motion,
        ] = iter.current;
        const targetXs = motion[MoveTowards3.TargetX];
        const targetYs = motion[MoveTowards3.TargetY];
        const targetZs = motion[MoveTowards3.TargetZ];
        const maximumSpeeds = motion[MoveTowards3.MaximumSpeed];
        const accelerations = motion[MoveTowards3.Acceleration];
        const arrivalRadii = motion[MoveTowards3.ArrivalRadius];
        for (let row = 0; row < count; row++) {
            const normalizedRank = reserveCount <= 1
                ? 0
                : rank / (reserveCount - 1) * 2 - 1;
            const fanAngle =
                normalizedRank * RECALL_FAN_HALF_ANGLE;
            const cosine = Math.cos(fanAngle);
            const sine = Math.sin(fanAngle);
            const fanX = backX * cosine - backZ * sine;
            const fanZ = backX * sine + backZ * cosine;
            const phase = rank * Math.PI * 2 / reserveCount;
            const radialBreath = Math.sin(
                time.elapsed * RECALL_BREATH_SPEED +
                phase * RECALL_BREATH_PHASE_SCALE,
            ) * Math.min(
                RECALL_MAXIMUM_BREATH_RADIUS,
                verticalAmplitude *
                RECALL_BREATH_AMPLITUDE_MULTIPLIER,
            );
            const fanHeight = height +
                (1 - Math.abs(normalizedRank)) *
                RECALL_CENTER_HEIGHT_BONUS;
            const wave = Math.sin(
                time.elapsed * verticalSpeed + phase,
            ) * verticalAmplitude * RECALL_WAVE_MULTIPLIER;
            const animatedRadius = radius + radialBreath;
            targetXs[row] = centerX + fanX * animatedRadius;
            targetYs[row] = centerY + fanHeight + wave;
            targetZs[row] = centerZ + fanZ * animatedRadius;
            maximumSpeeds[row] = 10;
            accelerations[row] = 32;
            arrivalRadii[row] = 0.03;
            rank++;
        }
    }
}

function orientReserveSwordFan(
    time: Readonly<TimeState>,
    reserves: ReserveMotion,
    owners: ReserveOwners,
): void {
    readOwnerForward(owners);
    const rightX = ownerForward.z;
    const rightZ = -ownerForward.x;
    const reserveCount = countReserveSwords(reserves);
    let rank = 0;
    const iter = reserves.iter();
    while (iter.next()) {
        const [count, , , , , , , directions] = iter.current;
        const directionXs = directions[Float3.X];
        const directionYs = directions[Float3.Y];
        const directionZs = directions[Float3.Z];
        for (let row = 0; row < count; row++) {
            const normalizedRank = reserveCount <= 1
                ? 0
                : rank / (reserveCount - 1) * 2 - 1;
            const phase = rank * Math.PI * 2 / reserveCount;
            const sway = Math.sin(
                time.elapsed * RECALL_SWAY_SPEED + phase,
            ) * RECALL_SWAY_ANGLE;
            const angle =
                normalizedRank * RECALL_MAXIMUM_TILT + sway;
            const horizontal = Math.sin(angle);
            directionXs[row] = rightX * horizontal;
            directionYs[row] = Math.cos(angle);
            directionZs[row] = rightZ * horizontal;
            rank++;
        }
    }
}

function countReserveSwords(reserves: ReserveMotion): number {
    let result = 0;
    const iter = reserves.iter();
    while (iter.next()) result += iter.current[0];
    return result;
}

function readOwnerForward(owners: ReserveOwners): void {
    ownerForward.x = 0;
    ownerForward.z = 1;
    const iter = owners.iter();
    while (iter.next()) {
        const [count, , , directions] = iter.current;
        if (count === 0) continue;
        const x = directions[Float3.X][0];
        const z = directions[Float3.Z][0];
        const length = Math.sqrt(x * x + z * z);
        if (length > 1e-5) {
            ownerForward.x = x / length;
            ownerForward.z = z / length;
        }
        return;
    }
}

export function rollSwordDamage(
    minimum: number,
    maximum: number,
    sword: Entity,
    sequence: number,
): number {
    let state = (sword ^ Math.imul(sequence + 1, 0x9e3779b1)) >>> 0;
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const ratio = (state >>> 0) / 0xffffffff;
    return minimum + (maximum - minimum) * ratio;
}

const FORMATION_SWORD_SPIRIT_DRAIN_PER_SECOND = 6;
const SPIRIT_RECOVERY_DELAY_TICKS = 30;
const RESERVE_ACTIVATION_RATIO = 0.5;
const RECALL_FAN_HALF_ANGLE = Math.PI * 2 / 9;
const RECALL_MINIMUM_RADIUS = 1.2;
const RECALL_MAXIMUM_RADIUS = 2.4;
const RECALL_MINIMUM_HEIGHT = 0.9;
const RECALL_CENTER_HEIGHT_BONUS = 0.35;
const RECALL_WAVE_MULTIPLIER = 0.32;
const RECALL_BREATH_SPEED = 1.35;
const RECALL_BREATH_PHASE_SCALE = 0.65;
const RECALL_BREATH_AMPLITUDE_MULTIPLIER = 0.14;
const RECALL_MAXIMUM_BREATH_RADIUS = 0.12;
const RECALL_MAXIMUM_TILT = Math.PI * 0.18;
const RECALL_SWAY_ANGLE = Math.PI / 72;
const RECALL_SWAY_SPEED = 1.8;
const ownerForward = { x: 0, z: 1 };
