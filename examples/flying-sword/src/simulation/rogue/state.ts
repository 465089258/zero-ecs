import {
    State,
    type Entity,
    type EntityAccess,
} from "@zero-ecs/game";

/** 玩家中心固定范围均匀网格；数组只按高水位扩容。 */
export class EnemySpatialIndexState extends State {
    readonly cellHeads = new Int32Array(GRID_WIDTH * GRID_HEIGHT);
    next = new Int32Array(INITIAL_CAPACITY);
    entities = new Uint32Array(INITIAL_CAPACITY);
    xs = new Float32Array(INITIAL_CAPACITY);
    ys = new Float32Array(INITIAL_CAPACITY);
    zs = new Float32Array(INITIAL_CAPACITY);
    radii = new Float32Array(INITIAL_CAPACITY);
    count = 0;
    originX = 0;
    originZ = 0;

    ensureCapacity(required: number): void {
        if (required <= this.entities.length) return;
        let capacity = this.entities.length;
        while (capacity < required) capacity *= 2;
        this.next = growInt32(this.next, capacity);
        this.entities = growUint32(this.entities, capacity);
        this.xs = growFloat32(this.xs, capacity);
        this.ys = growFloat32(this.ys, capacity);
        this.zs = growFloat32(this.zs, capacity);
        this.radii = growFloat32(this.radii, capacity);
    }

    reset(centerX: number, centerZ: number): void {
        this.count = 0;
        this.originX =
            Math.floor(centerX / GRID_CELL_SIZE) * GRID_CELL_SIZE -
            GRID_HALF_EXTENT;
        this.originZ =
            Math.floor(centerZ / GRID_CELL_SIZE) * GRID_CELL_SIZE -
            GRID_HALF_EXTENT;
        this.cellHeads.fill(-1);
    }

    insert(
        entity: Entity,
        x: number,
        y: number,
        z: number,
        radius: number,
    ): void {
        const cellX = Math.floor((x - this.originX) / GRID_CELL_SIZE);
        const cellZ = Math.floor((z - this.originZ) / GRID_CELL_SIZE);
        if (
            cellX < 0 || cellX >= GRID_WIDTH ||
            cellZ < 0 || cellZ >= GRID_HEIGHT
        ) {
            return;
        }
        const index = this.count++;
        this.ensureCapacity(this.count);
        const cell = cellZ * GRID_WIDTH + cellX;
        this.entities[index] = entity;
        this.xs[index] = x;
        this.ys[index] = y;
        this.zs[index] = z;
        this.radii[index] = radius;
        this.next[index] = this.cellHeads[cell];
        this.cellHeads[cell] = index;
    }
}

/** Damage 热路径复用的实体定位结果。 */
export class RogueEntityAccessState extends State {
    readonly access: EntityAccess = {
        archetype: null,
        row: 0 as EntityAccess["row"],
    };
}

/** 集火贯穿接触复用的敌人实体定位结果。 */
export class FocusSwordContactAccessState extends State {
    readonly access: EntityAccess = {
        archetype: null,
        row: 0 as EntityAccess["row"],
    };
}

/** 雷意伤害后处理复用的实体定位结果。 */
export class LightningChainAccessState extends State {
    readonly access: EntityAccess = {
        archetype: null,
        row: 0 as EntityAccess["row"],
    };
}

/** 飞剑接触系统每 Tick 派生的动作快照，避免逐剑重复遍历动作 Query。 */
export class CombatScratchState extends State {
    actionEntities = new Uint32Array(4);
    actionGroups = new Uint32Array(4);
    damages = new Float32Array(4);
    actionCount = 0;
    readonly activeTaskSwords = new Set<Entity>();
    readonly activeActionSwords = new Set<Entity>();
    readonly formationGroups = new Set<Entity>();
    readonly groupDamages = new Map<Entity, number>();
    readonly groupFocusDamages = new Map<Entity, number>();
    readonly groupFormationDamages = new Map<Entity, number>();
    readonly groupReattackDelays = new Map<Entity, number>();
    readonly groupFormationContactCooldowns =
        new Map<Entity, number>();
    readonly groupLightningChainCounts = new Map<Entity, number>();
    readonly groupLightningChainRadii = new Map<Entity, number>();
    readonly groupLightningDamageMultipliers =
        new Map<Entity, number>();
    readonly groupMetalMaximumMomentum = new Map<Entity, number>();
    readonly groupMetalDamagePerMomentum = new Map<Entity, number>();
    readonly targetedSwordCounts = new Map<Entity, number>();

    reset(required: number): void {
        this.actionCount = 0;
        if (required <= this.actionEntities.length) return;
        let capacity = this.actionEntities.length;
        while (capacity < required) capacity *= 2;
        this.actionEntities = growUint32(this.actionEntities, capacity);
        this.actionGroups = growUint32(this.actionGroups, capacity);
        this.damages = growFloat32(this.damages, capacity);
    }

    resetMembership(): void {
        this.activeTaskSwords.clear();
        this.activeActionSwords.clear();
        this.formationGroups.clear();
    }

    dispose(): void {
        this.activeTaskSwords.clear();
        this.activeActionSwords.clear();
        this.formationGroups.clear();
        this.groupDamages.clear();
        this.groupFocusDamages.clear();
        this.groupFormationDamages.clear();
        this.groupReattackDelays.clear();
        this.groupFormationContactCooldowns.clear();
        this.groupLightningChainCounts.clear();
        this.groupLightningChainRadii.clear();
        this.groupLightningDamageMultipliers.clear();
        this.groupMetalMaximumMomentum.clear();
        this.groupMetalDamagePerMomentum.clear();
        this.targetedSwordCounts.clear();
        this.actionCount = 0;
    }
}

abstract class PiercingCandidateState extends State {
    indices = new Uint32Array(8);
    progresses = new Float32Array(8);
    count = 0;

    reset(): void {
        this.count = 0;
    }

    insert(index: number, progress: number): void {
        const row = this.count++;
        this.ensureCapacity(this.count);
        this.indices[row] = index;
        this.progresses[row] = progress;
    }

    sort(entities: Uint32Array): void {
        const indices = this.indices;
        const progresses = this.progresses;
        for (let row = 1; row < this.count; row++) {
            const index = indices[row];
            const progress = progresses[row];
            const entity = entities[index];
            let insertAt = row;
            while (insertAt > 0) {
                const previousIndex = indices[insertAt - 1];
                const previousProgress = progresses[insertAt - 1];
                if (
                    previousProgress < progress ||
                    (
                        previousProgress === progress &&
                        entities[previousIndex] <= entity
                    )
                ) {
                    break;
                }
                indices[insertAt] = previousIndex;
                progresses[insertAt] = previousProgress;
                insertAt--;
            }
            indices[insertAt] = index;
            progresses[insertAt] = progress;
        }
    }

    private ensureCapacity(required: number): void {
        if (required <= this.indices.length) return;
        let capacity = this.indices.length;
        while (capacity < required) capacity *= 2;
        this.indices = growUint32(this.indices, capacity);
        this.progresses = growFloat32(this.progresses, capacity);
    }
}

/** 集火贯穿候选复用缓冲；只按高水位扩容。 */
export class FocusPiercingCandidateState
extends PiercingCandidateState {}

/** 身剑合一核心贯穿候选复用缓冲；只按高水位扩容。 */
export class FusionPiercingCandidateState
extends PiercingCandidateState {}

/** 分散御剑分配空闲飞剑时复用的目标候选 SoA。 */
export class FlyingSwordTargetingState extends State {
    entities = new Uint32Array(INITIAL_CAPACITY);
    xs = new Float32Array(INITIAL_CAPACITY);
    ys = new Float32Array(INITIAL_CAPACITY);
    zs = new Float32Array(INITIAL_CAPACITY);
    distances = new Float32Array(INITIAL_CAPACITY);
    priorities = new Uint8Array(INITIAL_CAPACITY);
    count = 0;

    reset(): void {
        this.count = 0;
    }

    insert(
        entity: Entity,
        x: number,
        y: number,
        z: number,
        distance: number,
        priority: number,
    ): void {
        const index = this.count++;
        this.ensureCapacity(this.count);
        this.entities[index] = entity;
        this.xs[index] = x;
        this.ys[index] = y;
        this.zs[index] = z;
        this.distances[index] = distance;
        this.priorities[index] = priority;
    }

    swap(left: number, right: number): void {
        if (left === right) return;
        swapUint32(this.entities, left, right);
        swapFloat32(this.xs, left, right);
        swapFloat32(this.ys, left, right);
        swapFloat32(this.zs, left, right);
        swapFloat32(this.distances, left, right);
        swapUint8(this.priorities, left, right);
    }

    private ensureCapacity(required: number): void {
        if (required <= this.entities.length) return;
        let capacity = this.entities.length;
        while (capacity < required) capacity *= 2;
        this.entities = growUint32(this.entities, capacity);
        this.xs = growFloat32(this.xs, capacity);
        this.ys = growFloat32(this.ys, capacity);
        this.zs = growFloat32(this.zs, capacity);
        this.distances = growFloat32(this.distances, capacity);
        this.priorities = growUint8(this.priorities, capacity);
    }
}

export const GRID_CELL_SIZE = 2;
export const GRID_WIDTH = 48;
export const GRID_HEIGHT = 48;
export const GRID_HALF_EXTENT = GRID_CELL_SIZE * GRID_WIDTH * 0.5;

const INITIAL_CAPACITY = 256;

function growInt32(
    source: Int32Array<ArrayBufferLike>,
    capacity: number,
): Int32Array<ArrayBuffer> {
    const result = new Int32Array(capacity);
    result.set(source);
    return result;
}

function growUint32(
    source: Uint32Array<ArrayBufferLike>,
    capacity: number,
): Uint32Array<ArrayBuffer> {
    const result = new Uint32Array(capacity);
    result.set(source);
    return result;
}

function growFloat32(
    source: Float32Array<ArrayBufferLike>,
    capacity: number,
): Float32Array<ArrayBuffer> {
    const result = new Float32Array(capacity);
    result.set(source);
    return result;
}

function growUint8(
    source: Uint8Array<ArrayBufferLike>,
    capacity: number,
): Uint8Array<ArrayBuffer> {
    const result = new Uint8Array(capacity);
    result.set(source);
    return result;
}

function swapUint32(
    values: Uint32Array,
    left: number,
    right: number,
): void {
    const value = values[left];
    values[left] = values[right];
    values[right] = value;
}

function swapUint8(
    values: Uint8Array,
    left: number,
    right: number,
): void {
    const value = values[left];
    values[left] = values[right];
    values[right] = value;
}

function swapFloat32(
    values: Float32Array,
    left: number,
    right: number,
): void {
    const value = values[left];
    values[left] = values[right];
    values[right] = value;
}
