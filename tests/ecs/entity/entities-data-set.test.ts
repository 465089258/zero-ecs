import { expect, test } from "@rstest/core";
import {
    Allocator,
    AllocatorService,
    type Component,
    defineComponentMeta,
    GameBuilder,
    type Entity,
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

test("World entities and Archetypes share DataSet-backed Buffer memory", () => {
    const ecs = new GameBuilder().build();
    ecs.init();
    const entities = ecs.world;
    const position = defineComponentMeta(entities, PositionType);
    const health = defineComponentMeta(entities, HealthType);
    const positionId = position.id;
    const healthId = health.id;
    const first = entities.reserveEntity();
    const second = entities.reserveEntity();

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
    const position = defineComponentMeta(world, PositionType);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);
    const entities: Entity[] = [];

    for (let i = 0; i <= archetype.chunkCapacity; i++) {
        const entity = world.reserveEntity();
        world.migrate(entity, position.mask, [position], (target, row) => {
            target.setField(row, position.id, Position.x, i + 0.5);
        });
        entities.push(entity);
    }

    expect(archetype.chunkCount).toBe(2);
    expect(archetype.views).toHaveLength(2);
    expect(archetype.entities).toHaveLength(2);
    expect(archetype.chunkRowCount(0)).toBe(archetype.chunkCapacity);
    expect(archetype.chunkRowCount(1)).toBe(1);
    expect(archetype.views[1][position.id]?.[Position.x][0]).toBe(archetype.chunkCapacity + 0.5);
    expect(archetype.entities[1][0]).toBe(entities[entities.length - 1]);

    expect(world.despawn(entities.pop()!)).toBe(true);
    expect(archetype.chunkCount).toBe(1);
    expect(archetype.views).toHaveLength(2);

    const query = world.query(QueryType.from(With(PositionType)));
    let iter = query.iter();
    expect(iter.next()).toBe(true);
    expect(iter.current[0]).toBe(archetype.chunkCapacity);
    expect(iter.current[2]).toBe(archetype.views[0][position.id]);
    expect(iter.next()).toBe(false);

    const reused = world.reserveEntity();
    world.migrate(reused, position.mask, [position], () => {});
    iter = query.iter();
    let count = 0;
    while (iter.next()) count += iter.current[0];
    expect(count).toBe(archetype.chunkCapacity + 1);

    world.dispose();
    expect(allocator.stats().allocatedBuffers).toBe(0);
    allocator.clear();
});

test("Archetype releases and recreates only continuous tail Chunks", () => {
    const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
    const world = new World(allocator);
    const position = defineComponentMeta(world, PositionType);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);
    const entities: Entity[] = [];
    const capacity = archetype.chunkCapacity;

    for (let i = 0; i < capacity * 3; i++) {
        const entity = world.reserveEntity();
        world.migrate(entity, position.mask, [position], () => {});
        entities.push(entity);
    }
    expect(archetype.chunkCount).toBe(3);
    expect(archetype.views).toHaveLength(3);

    for (let i = 0; i < capacity * 2; i++) {
        expect(world.despawn(entities.pop()!)).toBe(true);
    }
    expect(archetype.chunkCount).toBe(1);
    expect(archetype.views).toHaveLength(2);
    const retained = archetype.views[1];

    for (let i = 0; i < capacity; i++) {
        const entity = world.reserveEntity();
        world.migrate(entity, position.mask, [position], () => {});
        entities.push(entity);
    }
    expect(archetype.chunkCount).toBe(2);
    expect(archetype.views).toHaveLength(2);
    expect(archetype.views[1]).toBe(retained);

    const overflow = world.reserveEntity();
    world.migrate(overflow, position.mask, [position], () => {});
    entities.push(overflow);
    expect(archetype.chunkCount).toBe(3);
    expect(archetype.views).toHaveLength(3);

    let count = 0;
    const iter = world.query(QueryType.from(With(PositionType))).iter();
    while (iter.next()) count += iter.current[0];
    expect(count).toBe(entities.length);

    world.dispose();
    expect(allocator.stats().allocatedBuffers).toBe(0);
    allocator.clear();
});

test("Entity handles stay unsigned when the packed high bit is set", () => {
    const ecs = new GameBuilder().build();
    ecs.init();
    const entities = ecs.world;
    let entity = 0 as Entity;
    for (let i = 0; i < 524_288; i++) entity = entities.reserveEntity();

    expect(entity).toBe(entity >>> 0);
    expect(entities.valid(entity)).toBe(true);
    ecs.dispose();
});

test("retires an Entity slot before its generation can wrap", () => {
    const ecs = new GameBuilder().build();
    ecs.init();
    const entities = ecs.world;
    const stale = entities.reserveEntity();
    let current = stale;

    for (let i = 0; i < 4095; i++) {
        expect(entities.despawn(current)).toBe(true);
        current = entities.reserveEntity();
    }

    expect(entities.valid(stale)).toBe(false);
    expect(current).not.toBe(stale);
    expect(entities.getRawIndex(current)).not.toBe(entities.getRawIndex(stale));
    ecs.dispose();
});
