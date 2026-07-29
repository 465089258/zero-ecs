import {
    Update,
    Write,
    defSystem,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";
import { TimeState } from "@zero-ecs/game/time";
import {
    MotionSystemSet,
    MoveTowards3,
} from "../../../infrastructure/motion";
import { Float3 } from "../../../infrastructure/math";
import {
    EnemyBody,
    Health,
    RvoAgent,
} from "../components";
import { RogueRvoAgentQuery } from "../queries";
import {
    RVO_GRID_SIZE,
    RVO_MAX_NEIGHBORS,
    RvoSolverState,
} from "../state";
import { RogueSystemSet } from "../systems";

type Agents = QueryOf<typeof RogueRvoAgentQuery>;

export const resolveRvoAvoidanceSystem = defSystem(
    Update.fixed,
    resolveRvoAvoidance,
    [TimeState, Write(RvoSolverState), RogueRvoAgentQuery],
);

export const RvoSystemOptions = Object.freeze({
    after: MotionSystemSet.Integrate3,
    before: RogueSystemSet.Spatial,
});

function resolveRvoAvoidance(
    time: Readonly<TimeState>,
    state: Mut<RvoSolverState>,
    agents: Agents,
): void {
    snapshotAgents(state, agents);
    if (state.count <= 1) return;
    buildGrid(state);
    for (let index = 0; index < state.count; index++) {
        solveAgent(state, index, time.delta);
    }
    applyResults(state, agents, time.delta);
}

function snapshotAgents(state: Mut<RvoSolverState>, agents: Agents): void {
    state.count = 0;
    let minimumX = Number.POSITIVE_INFINITY;
    let minimumZ = Number.POSITIVE_INFINITY;
    const iter = agents.iter();
    while (iter.next()) {
        const [
            count,
            ,
            positions,
            ,
            velocities,
            ,
            motions,
            bodies,
            health,
            settings,
        ] = iter.current;
        state.ensureCapacity(state.count + count);
        const xs = positions[Float3.X];
        const zs = positions[Float3.Z];
        const velocityXs = velocities[Float3.X];
        const velocityZs = velocities[Float3.Z];
        const speeds = motions[MoveTowards3.MaximumSpeed];
        const radii = bodies[EnemyBody.Radius];
        const currentHealth = health[Health.Current];
        const neighborDistances = settings[RvoAgent.NeighborDistance];
        const horizons = settings[RvoAgent.TimeHorizon];
        const neighborLimits = settings[RvoAgent.MaximumNeighbors];
        const radiusScales = settings[RvoAgent.RadiusScale];
        const responsibilities = settings[RvoAgent.Responsibility];
        for (let row = 0; row < count; row++) {
            if (currentHealth[row] <= 0) continue;
            const index = state.count++;
            const x = xs[row];
            const z = zs[row];
            state.xs[index] = x;
            state.zs[index] = z;
            state.velocityXs[index] = velocityXs[row];
            state.velocityZs[index] = velocityZs[row];
            state.preferredXs[index] = velocityXs[row];
            state.preferredZs[index] = velocityZs[row];
            state.maximumSpeeds[index] = Math.max(0, speeds[row]);
            state.radii[index] =
                Math.max(0.05, radii[row] * radiusScales[row]);
            state.neighborDistances[index] =
                Math.max(0.1, neighborDistances[row]);
            state.timeHorizons[index] = Math.max(0.05, horizons[row]);
            state.maximumNeighbors[index] =
                Math.min(RVO_MAX_NEIGHBORS, neighborLimits[row]);
            state.responsibilities[index] =
                Math.max(0, Math.min(1, responsibilities[row]));
            minimumX = Math.min(minimumX, x);
            minimumZ = Math.min(minimumZ, z);
        }
    }
    state.originX = Math.floor(minimumX / CELL_SIZE) * CELL_SIZE;
    state.originZ = Math.floor(minimumZ / CELL_SIZE) * CELL_SIZE;
}

function buildGrid(state: Mut<RvoSolverState>): void {
    state.cellHeads.fill(-1);
    for (let index = 0; index < state.count; index++) {
        const cellX = gridCoordinate(state.xs[index] - state.originX);
        const cellZ = gridCoordinate(state.zs[index] - state.originZ);
        const cell = cellZ * RVO_GRID_SIZE + cellX;
        state.next[index] = state.cellHeads[cell];
        state.cellHeads[cell] = index;
    }
}

function solveAgent(
    state: Mut<RvoSolverState>,
    agent: number,
    delta: number,
): void {
    if (state.responsibilities[agent] <= 0) {
        state.resultXs[agent] = state.preferredXs[agent];
        state.resultZs[agent] = state.preferredZs[agent];
        return;
    }
    const neighborCount = findNeighbors(state, agent);
    let lineCount = 0;
    for (let neighbor = 0; neighbor < neighborCount; neighbor++) {
        buildOrcaLine(
            state,
            agent,
            state.neighborIndices[neighbor],
            lineCount++,
            delta,
        );
    }
    solveLinearProgram(state, agent, lineCount);
}

function findNeighbors(state: Mut<RvoSolverState>, agent: number): number {
    const range = state.neighborDistances[agent];
    let count = 0;
    const centerX = gridCoordinate(state.xs[agent] - state.originX);
    const centerZ = gridCoordinate(state.zs[agent] - state.originZ);
    const cellRange = Math.min(3, Math.ceil(range / CELL_SIZE));
    const maximum = state.maximumNeighbors[agent];
    let maximumDistanceSquared = range * range;
    for (let dz = -cellRange; dz <= cellRange; dz++) {
        const cellZ = centerZ + dz;
        if (cellZ < 0 || cellZ >= RVO_GRID_SIZE) continue;
        for (let dx = -cellRange; dx <= cellRange; dx++) {
            const cellX = centerX + dx;
            if (cellX < 0 || cellX >= RVO_GRID_SIZE) continue;
            let other =
                state.cellHeads[cellZ * RVO_GRID_SIZE + cellX];
            while (other >= 0) {
                if (other !== agent) {
                    const offsetX = state.xs[other] - state.xs[agent];
                    const offsetZ = state.zs[other] - state.zs[agent];
                    const distanceSquared =
                        offsetX * offsetX + offsetZ * offsetZ;
                    if (distanceSquared < maximumDistanceSquared) {
                        let insert = count;
                        while (
                            insert > 0 &&
                            distanceSquared <
                                state.neighborDistanceSquared[insert - 1]
                        ) {
                            if (insert < maximum) {
                                state.neighborDistanceSquared[insert] =
                                    state.neighborDistanceSquared[insert - 1];
                                state.neighborIndices[insert] =
                                    state.neighborIndices[insert - 1];
                            }
                            insert--;
                        }
                        if (insert < maximum) {
                            state.neighborDistanceSquared[insert] =
                                distanceSquared;
                            state.neighborIndices[insert] = other;
                            if (count < maximum) count++;
                            if (count === maximum) {
                                maximumDistanceSquared =
                                    state.neighborDistanceSquared[count - 1];
                            }
                        }
                    }
                }
                other = state.next[other];
            }
        }
    }
    return count;
}

function buildOrcaLine(
    state: Mut<RvoSolverState>,
    agent: number,
    other: number,
    line: number,
    delta: number,
): void {
    const relativeX = state.xs[other] - state.xs[agent];
    const relativeZ = state.zs[other] - state.zs[agent];
    const relativeVelocityX =
        state.velocityXs[agent] - state.velocityXs[other];
    const relativeVelocityZ =
        state.velocityZs[agent] - state.velocityZs[other];
    const distanceSquared =
        relativeX * relativeX + relativeZ * relativeZ;
    const combinedRadius = state.radii[agent] + state.radii[other];
    const combinedRadiusSquared = combinedRadius * combinedRadius;
    let directionX = 0;
    let directionZ = 0;
    let correctionX = 0;
    let correctionZ = 0;
    const inverseTime = distanceSquared > combinedRadiusSquared
        ? 1 / state.timeHorizons[agent]
        : 1 / Math.max(delta, 1 / 120);
    const wX = relativeVelocityX - inverseTime * relativeX;
    const wZ = relativeVelocityZ - inverseTime * relativeZ;
    const wLengthSquared = wX * wX + wZ * wZ;
    const dot = wX * relativeX + wZ * relativeZ;
    if (
        distanceSquared > combinedRadiusSquared &&
        dot < 0 &&
        dot * dot > combinedRadiusSquared * wLengthSquared
    ) {
        const wLength = Math.sqrt(wLengthSquared);
        const unitX = wLength > EPSILON ? wX / wLength : 1;
        const unitZ = wLength > EPSILON ? wZ / wLength : 0;
        directionX = unitZ;
        directionZ = -unitX;
        const scale = combinedRadius * inverseTime - wLength;
        correctionX = scale * unitX;
        correctionZ = scale * unitZ;
    } else if (distanceSquared > combinedRadiusSquared) {
        const leg = Math.sqrt(
            Math.max(0, distanceSquared - combinedRadiusSquared),
        );
        if (det(relativeX, relativeZ, wX, wZ) > 0) {
            directionX =
                (relativeX * leg - relativeZ * combinedRadius) /
                distanceSquared;
            directionZ =
                (relativeX * combinedRadius + relativeZ * leg) /
                distanceSquared;
        } else {
            directionX =
                -(relativeX * leg + relativeZ * combinedRadius) /
                distanceSquared;
            directionZ =
                -(-relativeX * combinedRadius + relativeZ * leg) /
                distanceSquared;
        }
        const projection =
            relativeVelocityX * directionX +
            relativeVelocityZ * directionZ;
        correctionX = projection * directionX - relativeVelocityX;
        correctionZ = projection * directionZ - relativeVelocityZ;
    } else {
        const wLength = Math.sqrt(wLengthSquared);
        const unitX = wLength > EPSILON
            ? wX / wLength
            : relativeX >= 0 ? -1 : 1;
        const unitZ = wLength > EPSILON ? wZ / wLength : 0;
        directionX = unitZ;
        directionZ = -unitX;
        const scale = combinedRadius * inverseTime - wLength;
        correctionX = scale * unitX;
        correctionZ = scale * unitZ;
    }
    const responsibility = 0.5 * state.responsibilities[agent];
    state.linePointXs[line] =
        state.velocityXs[agent] + correctionX * responsibility;
    state.linePointZs[line] =
        state.velocityZs[agent] + correctionZ * responsibility;
    state.lineDirectionXs[line] = directionX;
    state.lineDirectionZs[line] = directionZ;
}

function solveLinearProgram(
    state: Mut<RvoSolverState>,
    agent: number,
    lineCount: number,
): void {
    const maximumSpeed = state.maximumSpeeds[agent];
    let resultX = state.preferredXs[agent];
    let resultZ = state.preferredZs[agent];
    const speedSquared = resultX * resultX + resultZ * resultZ;
    if (speedSquared > maximumSpeed * maximumSpeed) {
        const scale = maximumSpeed / Math.sqrt(speedSquared);
        resultX *= scale;
        resultZ *= scale;
    }
    for (let pass = 0; pass < 3; pass++) {
        for (let line = 0; line < lineCount; line++) {
            const directionX = state.lineDirectionXs[line];
            const directionZ = state.lineDirectionZs[line];
            const pointX = state.linePointXs[line];
            const pointZ = state.linePointZs[line];
            const violation = det(
                directionX,
                directionZ,
                pointX - resultX,
                pointZ - resultZ,
            );
            if (violation <= 0) continue;
            resultX -= directionZ * violation;
            resultZ += directionX * violation;
            const lengthSquared = resultX * resultX + resultZ * resultZ;
            if (lengthSquared > maximumSpeed * maximumSpeed) {
                const scale = maximumSpeed / Math.sqrt(lengthSquared);
                resultX *= scale;
                resultZ *= scale;
            }
        }
    }
    state.resultXs[agent] = resultX;
    state.resultZs[agent] = resultZ;
}

function applyResults(
    state: Mut<RvoSolverState>,
    agents: Agents,
    delta: number,
): void {
    let index = 0;
    const iter = agents.iter();
    while (iter.next()) {
        const [
            count,
            ,
            positions,
            previous,
            velocities,
            directions,
            ,
            ,
            health,
        ] = iter.current;
        const xs = positions[Float3.X];
        const zs = positions[Float3.Z];
        const previousXs = previous[Float3.X];
        const previousZs = previous[Float3.Z];
        const velocityXs = velocities[Float3.X];
        const velocityZs = velocities[Float3.Z];
        const directionXs = directions[Float3.X];
        const directionZs = directions[Float3.Z];
        const currentHealth = health[Health.Current];
        for (let row = 0; row < count; row++) {
            if (currentHealth[row] <= 0) continue;
            const velocityX = state.resultXs[index];
            const velocityZ = state.resultZs[index++];
            velocityXs[row] = velocityX;
            velocityZs[row] = velocityZ;
            xs[row] = previousXs[row] + velocityX * delta;
            zs[row] = previousZs[row] + velocityZ * delta;
            const length = Math.sqrt(
                velocityX * velocityX + velocityZ * velocityZ,
            );
            if (length > EPSILON) {
                directionXs[row] = velocityX / length;
                directionZs[row] = velocityZ / length;
            }
        }
    }
}

function gridCoordinate(value: number): number {
    return Math.max(
        0,
        Math.min(RVO_GRID_SIZE - 1, Math.floor(value / CELL_SIZE)),
    );
}

function det(ax: number, az: number, bx: number, bz: number): number {
    return ax * bz - az * bx;
}

const CELL_SIZE = 2;
const EPSILON = 1e-6;
