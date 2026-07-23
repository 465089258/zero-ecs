import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    GameBuilder,
    Types,
    World,
} from "@zero-ecs/game";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const enum Health { value }
class HealthType implements Component<Health> {
    readonly [Health.value] = Types.I32;
}

function components(): World {
    const ecs = new GameBuilder().build();
    return ecs.world;
}

describe("World component registry", () => {
    test("defines a component lazily and idempotently", () => {
        const registry = components();

        const first = registry.component(PositionType);
        const second = registry.component(PositionType);

        expect(second).toBe(first);
        expect(first.type).toBe(PositionType);
        expect(first.layout).toEqual([Types.F32, Types.F32]);
        expect(Object.isFrozen(first)).toBe(true);
        expect(Object.isFrozen(first.layout)).toBe(true);
        expect("id" in first).toBe(true);
        expect("mask" in first).toBe(true);
    });

    test("allocates component IDs independently for each ECS instance", () => {
        const first = components();
        const second = components();

        expect(first.component(PositionType).id).toBe(0);
        expect(first.component(HealthType).id).toBe(1);
        expect(second.component(HealthType).id).toBe(0);
        expect(second.findComponent(PositionType)).toBeUndefined();
    });

    test("rejects non-consecutive runtime fields", () => {
        class InvalidType { readonly 1 = Types.F32; }
        expect(() => components().component(InvalidType)).toThrow(/consecutive integers/);
    });
});
