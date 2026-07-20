import { expect, test } from "@rstest/core";
import { AllocatorService, type Component, defineComponentMeta, GameBuilder, type Entity, Types } from "@zero-ecs/game/advanced";

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
    expect(entities.getCompLocation(second)).toEqual({ tableId: 0, row: 0 });
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
