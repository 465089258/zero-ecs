import { expect, test } from "@rstest/core";
import { type Component, ComponentService, defineComponentMeta, EcsBuilder, EcsMemoryService, type Entity, EntityService, Types } from "../../../src/advanced";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const enum Health { value }
class HealthType implements Component<Health> {
    readonly [Health.value] = Types.I32;
}

test("EntityService and Archetype share DataSet-backed chunk memory", () => {
    const ecs = new EcsBuilder().build();
    ecs.init();
    const components = ecs.service(ComponentService);
    const position = defineComponentMeta(components, PositionType);
    const health = defineComponentMeta(components, HealthType);
    const positionId = position.id;
    const healthId = health.id;
    const entities = ecs.service(EntityService);
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
    expect(entities.getCompLocation(second)).toEqual({ tableId: 0, row: 0 });
    const memory = ecs.service(EcsMemoryService);
    expect(memory.allocator.stats().allocatedChunks).toBeGreaterThanOrEqual(3);
    ecs.dispose();
    expect(memory.allocator.stats()).toEqual({
        blockCount: 0,
        chunkCapacity: 0,
        allocatedChunks: 0,
        freeChunks: 0,
        reservedBytes: 0,
        allocatedBytes: 0,
    });
});

test("Entity handles stay unsigned when the packed high bit is set", () => {
    const ecs = new EcsBuilder().build();
    ecs.init();
    const entities = ecs.service(EntityService);
    let entity = 0 as Entity;
    for (let i = 0; i < 524_288; i++) entity = entities.spawn();

    expect(entity).toBe(entity >>> 0);
    expect(entities.valid(entity)).toBe(true);
    ecs.dispose();
});

test("retires an Entity slot before its generation can wrap", () => {
    const ecs = new EcsBuilder().build();
    ecs.init();
    const entities = ecs.service(EntityService);
    const stale = entities.spawn();
    let current = stale;

    for (let i = 0; i < 4095; i++) {
        expect(entities.despawn(current)).toBe(true);
        current = entities.spawn();
    }

    expect(entities.valid(stale)).toBe(false);
    expect(current).not.toBe(stale);
    expect(entities.getRawIndex(current)).not.toBe(entities.getRawIndex(stale));
    ecs.dispose();
});
