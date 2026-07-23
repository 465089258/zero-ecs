import { expect, test } from "@rstest/core";
import {
    Allocator,
    AllocatorService,
    ArchetypeChunk,
    Buffer,
    type Component,
    entityIndexOf,
    GameBuilder,
    type Entity,
    type IAllocator,
    QueryType,
    Types,
    With,
    World,
} from "@zero-ecs/game/advanced";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const enum Health { value }
class HealthType implements Component<Health> {
    readonly [Health.value] = Types.I32;
}

class ThrowAfterDisposeBuffer extends Buffer {
    override doDispose(): void {
        super.doDispose();
        throw new Error("expected Buffer release failure");
    }
}

class FailingReleaseAllocator implements IAllocator {
    readonly config = Object.freeze({
        bufferByteLength: 64,
        blockByteLength: 256,
        buffersPerBlock: 4,
    });
    private allocationCount = 0;

    alloc(): Buffer {
        const source = new ArrayBuffer(this.config.bufferByteLength);
        return this.allocationCount++ === 0
            ? new Buffer(source)
            : new ThrowAfterDisposeBuffer(source);
    }

    stats() {
        return {
            blockCount: 0,
            bufferCapacity: 0,
            allocatedBuffers: 0,
            freeBuffers: 0,
            reservedBytes: 0,
            allocatedBytes: 0,
        };
    }
}

test("World entities and Archetypes share DataSet-backed Buffer memory", () => {
    const ecs = new GameBuilder().build();
    ecs.init();
    const entities = ecs.world;
    const position = entities.component(PositionType);
    const health = entities.component(HealthType);
    const positionId = position.id;
    const healthId = health.id;
    const first = entities.spawn();
    const second = entities.spawn();

    entities.migrate(first, position.mask, [position], (arch, row) => {
        arch.setField(row, positionId, 0, 12.5);
        arch.setField(row, positionId, 1, 25);
    });
    entities.migrate(second, position.mask, [position], () => {});

    const targetMask = position.mask.or(health.mask);
    entities.migrate(first, targetMask, [position, health], (arch, row) => {
        arch.setField(row, healthId, 0, 100);
    });

    expect(entities.has(first, PositionType)).toBe(true);
    expect(entities.has(second, HealthType)).toBe(false);
    expect(entities.get(first, PositionType, Position.x)).toBe(12.5);
    expect(entities.get(first, PositionType, Position.y)).toBe(25);
    expect(entities.get(first, HealthType, Health.value)).toBe(100);
    expect(entities.view(first, PositionType)?.[Position.x][0]).toBe(12.5);
    expect(entities.getTypes(first)).toEqual([PositionType, HealthType]);
    expect(entities.getCompLocation(second)).toEqual({ chunkIdx: 0, row: 0 });
    const allocator = ecs.service(AllocatorService).allocator;
    expect(allocator.stats().allocatedBuffers).toBeGreaterThanOrEqual(3);
    ecs.dispose();
    expect(allocator.stats()).toEqual({
        blockCount: 0,
        bufferCapacity: 0,
        allocatedBuffers: 0,
        freeBuffers: 0,
        reservedBytes: 0,
        allocatedBytes: 0,
    });
});

test("Archetype owns continuous Chunk rows and exposes cached component views", () => {
    const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
    const world = new World(allocator);
    const position = world.component(PositionType);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);
    const entities: Entity[] = [];

    for (let i = 0; i <= archetype.chunkCapacity; i++) {
        const entity = world.spawn();
        world.migrate(entity, position.mask, [position], (target, row) => {
            target.setField(row, position.id, Position.x, i + 0.5);
        });
        entities.push(entity);
    }

    expect(archetype.chunks).toBe(2);
    expect(archetype.allocatedChunkCount).toBe(2);
    expect(archetype.chunkRowCount(0)).toBe(archetype.chunkCapacity);
    expect(archetype.chunkRowCount(1)).toBe(1);
    const secondChunk = archetype.chunkAt(1)!;
    expect(secondChunk).toBeInstanceOf(ArchetypeChunk);
    expect(secondChunk.entities).toBe(secondChunk.columns[0]);
    expect(secondChunk.views[position.id]?.[Position.x]).toBe(secondChunk.columns[1]);
    expect(secondChunk.views[position.id]?.[Position.y]).toBe(secondChunk.columns[2]);
    expect(secondChunk.views[position.id]?.[Position.x][0]).toBe(archetype.chunkCapacity + 0.5);
    expect(secondChunk.entities[0]).toBe(entities[entities.length - 1]);

    expect(world.despawn(entities.pop()!)).toBe(true);
    expect(archetype.chunks).toBe(1);
    expect(archetype.allocatedChunkCount).toBe(1);
    expect(archetype.chunkAt(1)).toBeUndefined();

    const query = world.query(QueryType.from(With(PositionType)));
    let iter = query.iter();
    expect(iter.next()).toBe(true);
    expect(iter.current[0]).toBe(archetype.chunkCapacity);
    expect(iter.current[2]).toBe(archetype.chunkAt(0)?.views[position.id]);
    expect(iter.next()).toBe(false);

    const reused = world.spawn();
    world.migrate(reused, position.mask, [position], () => {});
    iter = query.iter();
    let count = 0;
    while (iter.next()) count += iter.current[0];
    expect(count).toBe(archetype.chunkCapacity + 1);

    world.dispose();
    expect(allocator.stats().allocatedBuffers).toBe(0);
    allocator.clear();
});

test("Archetype retains only the configured number of continuous tail Chunks", () => {
    const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
    const world = new World(allocator);
    const position = world.component(PositionType);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);
    archetype.setSpareChunkLimit(1);
    const entities: Entity[] = [];
    const capacity = archetype.chunkCapacity;

    for (let i = 0; i < capacity * 3; i++) {
        const entity = world.spawn();
        world.migrate(entity, position.mask, [position], () => {});
        entities.push(entity);
    }
    expect(archetype.chunks).toBe(3);
    expect(archetype.allocatedChunkCount).toBe(3);

    for (let i = 0; i < capacity * 2; i++) {
        expect(world.despawn(entities.pop()!)).toBe(true);
    }
    expect(archetype.chunks).toBe(1);
    expect(archetype.allocatedChunkCount).toBe(2);
    const retained = archetype.chunkAt(1);

    for (let i = 0; i < capacity; i++) {
        const entity = world.spawn();
        world.migrate(entity, position.mask, [position], () => {});
        entities.push(entity);
    }
    expect(archetype.chunks).toBe(2);
    expect(archetype.allocatedChunkCount).toBe(2);
    expect(archetype.chunkAt(1)).toBe(retained);

    const overflow = world.spawn();
    world.migrate(overflow, position.mask, [position], () => {});
    entities.push(overflow);
    expect(archetype.chunks).toBe(3);
    expect(archetype.allocatedChunkCount).toBe(3);

    let count = 0;
    const iter = world.query(QueryType.from(With(PositionType))).iter();
    while (iter.next()) count += iter.current[0];
    expect(count).toBe(entities.length);

    world.dispose();
    expect(allocator.stats().allocatedBuffers).toBe(0);
    allocator.clear();
});

test("Archetype defaults to full Chunk release and updates only its local version", () => {
    const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
    const world = new World(allocator);
    const position = world.component(PositionType);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);
    const worldVersion = world.version;
    const allocatedBeforeInsert = allocator.stats().allocatedBuffers;

    expect(archetype.spareChunkLimit).toBe(0);
    expect(archetype.version).toBe(0);

    const row = archetype.insert(1 as never);
    expect(world.version).toBe(worldVersion);
    expect(archetype.version).toBe(1);
    expect(archetype.allocatedChunkCount).toBe(1);
    expect(allocator.stats().allocatedBuffers).toBe(allocatedBeforeInsert + 1);

    archetype.remove(row);
    expect(world.version).toBe(worldVersion);
    expect(archetype.version).toBe(2);
    expect(archetype.chunks).toBe(0);
    expect(archetype.allocatedChunkCount).toBe(0);
    expect(allocator.stats().allocatedBuffers).toBe(allocatedBeforeInsert);

    world.dispose();
    allocator.clear();
});

test("Archetype validates and immediately applies spareChunkLimit changes", () => {
    const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
    const world = new World(allocator);
    const position = world.component(PositionType);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);

    for (const invalid of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => archetype.setSpareChunkLimit(invalid)).toThrow(
            /non-negative safe integer/,
        );
    }

    archetype.setSpareChunkLimit(1);
    expect(archetype.spareChunkLimit).toBe(1);
    expect(archetype.allocatedChunkCount).toBe(0);
    const row = archetype.insert(1 as never);
    const versionAfterInsert = archetype.version;
    archetype.remove(row);
    expect(archetype.allocatedChunkCount).toBe(1);
    expect(archetype.version).toBe(versionAfterInsert);

    archetype.setSpareChunkLimit(0);
    expect(archetype.allocatedChunkCount).toBe(0);
    expect(archetype.version).toBe(versionAfterInsert + 1);

    archetype.dispose();
    expect(() => archetype.setSpareChunkLimit(1)).toThrow(/disposed/);
    world.dispose();
    allocator.clear();
});

test("Archetype disposal keeps versions consistent and continues after Buffer release failures", () => {
    const allocator = new FailingReleaseAllocator();
    const world = new World(allocator);
    const position = world.component(PositionType);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);
    for (let i = 0; i < archetype.chunkCapacity * 3; i++) {
        archetype.insert((i + 1) as Entity);
    }
    const versionBeforeDispose = archetype.version;

    expect(() => archetype.dispose()).toThrow(/expected Buffer release failure/);
    expect(archetype.allocatedChunkCount).toBe(0);
    expect(archetype.version).toBe(versionBeforeDispose + 3);
    expect(() => archetype.setSpareChunkLimit(1)).toThrow(/disposed/);

    world.dispose();
});

test("Archetype reuses removed row data without clearing component fields", () => {
    const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
    const world = new World(allocator);
    const position = world.component(PositionType);
    const first = world.spawn();

    world.migrate(first, position.mask, [position], (target, row) => {
        target.setField(row, position.id, Position.x, 37.5);
    });
    expect(world.despawn(first)).toBe(true);

    const second = world.spawn();
    world.migrate(second, position.mask, [position], () => {});
    expect(world.get(second, PositionType, Position.x)).toBe(37.5);

    world.dispose();
    allocator.clear();
});

test("Entity handles stay unsigned when the packed high bit is set", () => {
    const ecs = new GameBuilder().build();
    ecs.init();
    const entities = ecs.world;
    let entity = 0 as Entity;
    for (let i = 0; i < 524_288; i++) entity = entities.spawn();

    expect(entity).toBe(entity >>> 0);
    expect(entities.valid(entity)).toBe(true);
    ecs.dispose();
});

test("quarantines an Entity slot before its generation can wrap", () => {
    const ecs = new GameBuilder().build();
    ecs.init();
    const entities = ecs.world;
    const stale = entities.spawn();
    let current = stale;

    for (let i = 0; i < 4095; i++) {
        expect(entities.despawn(current)).toBe(true);
        current = entities.spawn();
    }

    expect(entities.valid(stale)).toBe(false);
    expect(current).not.toBe(stale);
    expect(entityIndexOf(current)).not.toBe(entityIndexOf(stale));
    ecs.dispose();
});

test("free Entity slots stay invalid even when their next generation is guessed", () => {
    const ecs = new GameBuilder().build();
    ecs.init();
    const entities = ecs.world;
    const entity = entities.spawn();
    const nextGeneration = ((entity + 1) >>> 0) as Entity;

    expect(entities.despawn(entity)).toBe(true);
    expect(entities.valid(nextGeneration)).toBe(false);

    const reused = entities.spawn();
    expect(reused).toBe(nextGeneration);
    expect(entities.valid(reused)).toBe(true);
    ecs.dispose();
});
