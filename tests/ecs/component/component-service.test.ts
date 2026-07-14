import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    ComponentService,
    EcsBuilder,
    Types,
} from "../../../src";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const enum Health { value }
class HealthType implements Component<Health> {
    readonly [Health.value] = Types.I32;
}

function components(): ComponentService {
    const ecs = new EcsBuilder().build();
    ecs.init();
    return ecs.service(ComponentService);
}

describe("ComponentService", () => {
    test("defines a component lazily and idempotently", () => {
        const registry = components();

        expect(registry.get(PositionType)).toBeUndefined();
        const first = registry.def(PositionType);
        const second = registry.def(PositionType);

        expect(second).toBe(first);
        expect(registry.get(PositionType)).toBe(first);
        expect(registry.getById(first.id)).toBe(first);
        expect(first.type).toBe(PositionType);
        expect(first.layout).toEqual([Types.F32, Types.F32]);
        expect(Object.isFrozen(first)).toBe(true);
        expect(Object.isFrozen(first.layout)).toBe(true);
    });

    test("allocates component IDs independently for each ECS instance", () => {
        const first = components();
        const second = components();

        expect(first.def(PositionType).id).toBe(0);
        expect(first.def(HealthType).id).toBe(1);
        expect(second.def(HealthType).id).toBe(0);
        expect(second.get(PositionType)).toBeUndefined();
    });

    test("rejects non-consecutive runtime fields", () => {
        class InvalidType { readonly 1 = Types.F32; }
        expect(() => components().def(InvalidType)).toThrow(/consecutive integers/);
    });
});
