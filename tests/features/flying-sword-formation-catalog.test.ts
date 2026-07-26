import { expect, test } from "@rstest/core";
import {
    FlyingSwordFormationCatalog,
    FlyingSwordFormationPlanId,
    FlyingSwordFormationPrimitive,
    type FlyingSwordFormationRouteSample,
    type FlyingSwordFormationSlotSample,
} from "@zero-ecs/flying-sword";

test("formation catalog compiles built-in plans and samples finite tangents", () => {
    const catalog = new FlyingSwordFormationCatalog();
    const defaultPlan = catalog.require(
        FlyingSwordFormationPlanId.EightGates,
    );
    const lotusPlan = catalog.require(
        FlyingSwordFormationPlanId.Lotus,
    );
    expect(defaultPlan.name).toBe("八门周天阵");
    expect(defaultPlan.routeCount).toBe(3);
    expect(lotusPlan.name).toBe("莲华剑阵");
    expect(lotusPlan.routeCount).toBe(3);

    const sample = createRouteSample();
    for (const plan of [defaultPlan, lotusPlan]) {
        for (let route = 0; route < plan.routeCount; route++) {
            catalog.sampleRoute(plan.id, route, 0, sample);
            const startX = sample.x;
            const startY = sample.y;
            const startZ = sample.z;
            for (let step = 0; step < 32; step++) {
                catalog.sampleRoute(
                    plan.id,
                    route,
                    step * Math.PI * 2 / 32,
                    sample,
                );
                expect(Number.isFinite(sample.x)).toBe(true);
                expect(Number.isFinite(sample.y)).toBe(true);
                expect(Number.isFinite(sample.z)).toBe(true);
                const tangentLength = Math.sqrt(
                    sample.tangentX * sample.tangentX +
                    sample.tangentY * sample.tangentY +
                    sample.tangentZ * sample.tangentZ,
                );
                expect(tangentLength).toBeCloseTo(1, 5);
            }
            catalog.sampleRoute(
                plan.id,
                route,
                catalog.routePeriod(plan.id, route),
                sample,
            );
            expect(sample.x).toBeCloseTo(startX, 5);
            expect(sample.y).toBeCloseTo(startY, 5);
            expect(sample.z).toBeCloseTo(startZ, 5);
        }
    }
});

test("formation slot schedule scales deterministically without changing routes", () => {
    const catalog = new FlyingSwordFormationCatalog();
    const out = createSlotSample();
    const previousRoutes = new Uint16Array(49);
    const sizes = [1, 2, 7, 49, 500];
    for (let sizeIndex = 0; sizeIndex < sizes.length; sizeIndex++) {
        const size = sizes[sizeIndex];
        for (let slot = 0; slot < size; slot++) {
            catalog.resolveSlot(
                FlyingSwordFormationPlanId.Lotus,
                slot,
                size,
                out,
            );
            expect(out.route).toBeGreaterThanOrEqual(0);
            expect(out.route).toBeLessThan(3);
            expect(out.routeSlot).toBeGreaterThanOrEqual(0);
            expect(out.routeSlot).toBeLessThan(
                out.routeSwordCount,
            );
            expect(Number.isFinite(out.phaseOffset)).toBe(true);
            if (size === 49) previousRoutes[slot] = out.route;
            if (size === 500 && slot < 49) {
                expect(out.route).toBe(previousRoutes[slot]);
            }
        }
    }
});

test("formation catalog supports every initial path primitive", () => {
    const customPlanId = 17;
    const catalog = new FlyingSwordFormationCatalog([{
        id: customPlanId,
        name: "原语测试阵",
        routes: [
            {
                primitive:
                    FlyingSwordFormationPrimitive.RegularPolygon,
                radius: 1,
                vertices: 6,
            },
            {
                primitive:
                    FlyingSwordFormationPrimitive.StarPolygon,
                radius: 1,
                vertices: 5,
                innerRadius: 0.4,
            },
            {
                primitive:
                    FlyingSwordFormationPrimitive.Lemniscate,
                radius: 1,
            },
            {
                primitive: FlyingSwordFormationPrimitive.Rose,
                radius: 1,
                petals: 3,
            },
        ],
    }]);
    const sample = createRouteSample();
    for (let route = 0; route < 4; route++) {
        catalog.sampleRoute(
            customPlanId,
            route,
            Math.PI * 0.37,
            sample,
        );
        expect(Math.abs(sample.x) + Math.abs(sample.z))
            .toBeGreaterThan(0);
    }
});

test("formation catalog rejects invalid and duplicate plan definitions", () => {
    expect(() => new FlyingSwordFormationCatalog([{
        id: FlyingSwordFormationPlanId.EightGates,
        name: "重复",
        routes: [{
            primitive: FlyingSwordFormationPrimitive.Rose,
            radius: 1,
        }],
    }])).toThrow(/Duplicate/);
    expect(() => new FlyingSwordFormationCatalog([{
        id: 19,
        name: "错误方向",
        routes: [{
            primitive: FlyingSwordFormationPrimitive.Rose,
            radius: 1,
            direction: 0,
        }],
    }])).toThrow(/direction/);
});

function createRouteSample(): FlyingSwordFormationRouteSample {
    return {
        x: 0,
        y: 0,
        z: 0,
        tangentX: 0,
        tangentY: 0,
        tangentZ: 1,
    };
}

function createSlotSample(): FlyingSwordFormationSlotSample {
    return {
        route: 0,
        routeSlot: 0,
        routeSwordCount: 1,
        phaseOffset: 0,
    };
}
