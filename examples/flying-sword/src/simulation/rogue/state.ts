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
