import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    GameBuilder,
    Types,
    World,
} from "@zero-ecs/game";
import { defineComponentMeta } from "@zero-ecs/game/advanced";

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

        expect(registry.component(PositionType)).toBeUndefined();
        const first = registry.defineComponent(PositionType);
        const second = registry.defineComponent(PositionType);

        expect(second).toBe(first);
        expect(registry.component(PositionType)).toBe(first);
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

        expect(defineComponentMeta(first, PositionType).id).toBe(0);
        expect(defineComponentMeta(first, HealthType).id).toBe(1);
        expect(defineComponentMeta(second, HealthType).id).toBe(0);
        expect(second.component(PositionType)).toBeUndefined();
    });

    test("rejects non-consecutive runtime fields", () => {
        class InvalidType { readonly 1 = Types.F32; }
        expect(() => components().defineComponent(InvalidType)).toThrow(/consecutive integers/);
    });
});
