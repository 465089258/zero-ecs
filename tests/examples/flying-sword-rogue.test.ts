import {
    expect,
    test,
} from "@rstest/core";
import {
    nextRogueRandom,
    rogueRequiredExperienceFor,
    squaredDistanceToSegment3,
} from "../../examples/flying-sword/src/simulation/rogue/systems";
import {
    EnemySpatialIndexState,
    GRID_CELL_SIZE,
    GRID_HALF_EXTENT,
    GRID_WIDTH,
} from "../../examples/flying-sword/src/simulation/rogue/state";
import {
    RogueUpgrade,
    RogueUpgradeCatalog,
} from "../../examples/flying-sword/src/content/upgrades";
import {
    RogueRunTuning,
} from "../../examples/flying-sword/src/content/run-tuning";
import {
    shouldLaunchScatterSword,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/scatter-system";
import {
    steerDirection2Towards,
} from "../../examples/flying-sword/src/simulation/rogue/flying-sword/fusion-steering";

test("rogue random sequence is deterministic and never remains zero", () => {
    let left = 0;
    let right = 0;
    for (let index = 0; index < 8; index++) {
        left = nextRogueRandom(left);
        right = nextRogueRandom(right);
        expect(left).toBe(right);
        expect(left).not.toBe(0);
    }
});

test("experience requirement rises with level", () => {
    expect(rogueRequiredExperienceFor(1)).toBe(13);
    expect(rogueRequiredExperienceFor(2)).toBeGreaterThan(
        rogueRequiredExperienceFor(1),
    );
    expect(rogueRequiredExperienceFor(20)).toBeGreaterThan(
        rogueRequiredExperienceFor(10),
    );
});

test("upgrade catalog covers every combat route without missing metadata", () => {
    const catalog = new RogueUpgradeCatalog();
    expect(catalog.count).toBe(RogueUpgrade.FormationRange + 1);
    expect(catalog.names).toHaveLength(catalog.count);
    expect(catalog.descriptions).toHaveLength(catalog.count);
    expect(catalog.names[RogueUpgrade.FocusPower]).toContain("归一");
    expect(catalog.names[RogueUpgrade.ScatterRange]).toContain("分光");
    expect(catalog.names[RogueUpgrade.FormationPower]).toContain("周天");
    expect(catalog.names[RogueUpgrade.FusionPower]).toContain("合一");
    expect(
        catalog.descriptions[RogueUpgrade.FusionEfficiency],
    ).toContain("消耗降低");
    expect(
        catalog.descriptions[RogueUpgrade.FusionEndurance],
    ).toContain("最大体力增加");
    expect(catalog.names[RogueUpgrade.FormationRange])
        .toContain("广域");
    expect(catalog.descriptions[RogueUpgrade.FormationTempo])
        .toContain("运行速度提高");
});

test("fusion starts with a meaningful stamina drain budget", () => {
    const tuning = new RogueRunTuning("");
    expect(tuning.initialStamina).toBe(100);
    expect(tuning.fusionStaminaDrainPerSecond).toBe(40);
    expect(
        tuning.initialStamina /
        tuning.fusionStaminaDrainPerSecond,
    ).toBeCloseTo(2.5);
    expect(tuning.initialFormationRadius).toBeGreaterThan(3.15);
    expect(tuning.initialFormationAngularSpeed).toBeGreaterThan(0.72);
});

test("swept sword contact measures the whole segment", () => {
    expect(
        squaredDistanceToSegment3(
            5, 0, 0,
            0, 0, 0,
            10, 0, 0,
        ),
    ).toBe(0);
    expect(
        squaredDistanceToSegment3(
            5, 2, 0,
            0, 0, 0,
            10, 0, 0,
        ),
    ).toBe(4);
    expect(
        squaredDistanceToSegment3(
            12, 0, 0,
            0, 0, 0,
            10, 0, 0,
        ),
    ).toBe(4);
});

test("enemy spatial grid reuses storage, links cells, and clips outside", () => {
    const grid = new EnemySpatialIndexState();
    grid.reset(0, 0);
    grid.insert(11, 0, 0.5, 0, 0.4);
    grid.insert(12, 0.25, 0.5, 0.25, 0.5);

    const centerCell = (
        Math.floor((0 - grid.originZ) / GRID_CELL_SIZE) * GRID_WIDTH +
        Math.floor((0 - grid.originX) / GRID_CELL_SIZE)
    );
    expect(grid.count).toBe(2);
    expect(grid.cellHeads[centerCell]).toBe(1);
    expect(grid.next[1]).toBe(0);
    expect(grid.entities[0]).toBe(11);
    expect(grid.entities[1]).toBe(12);

    grid.insert(
        13,
        GRID_HALF_EXTENT + GRID_CELL_SIZE,
        0,
        0,
        0.4,
    );
    expect(grid.count).toBe(2);

    const previousEntities = grid.entities;
    grid.reset(1, 1);
    expect(grid.count).toBe(0);
    expect(grid.entities).toBe(previousEntities);
});

test("scatter launch cadence is derived from group combat values", () => {
    const launched: number[] = [];
    for (let slot = 0; slot < 7; slot++) {
        if (shouldLaunchScatterSword(8, slot, 7, 3)) {
            launched.push(slot);
        }
    }
    expect(launched).toEqual([2]);
    expect(shouldLaunchScatterSword(8, 2, 5, 1)).toBe(true);
    expect(shouldLaunchScatterSword(8, 2, 7, 3)).toBe(true);
});

test("fusion steering clamps turning instead of snapping to the cursor", () => {
    const xs = new Float32Array([1]);
    const zs = new Float32Array([0]);
    expect(
        steerDirection2Towards(
            xs,
            zs,
            0,
            0,
            1,
            Math.PI / 6,
        ),
    ).toBe(true);
    expect(xs[0]).toBeCloseTo(Math.cos(Math.PI / 6), 5);
    expect(zs[0]).toBeCloseTo(Math.sin(Math.PI / 6), 5);

    steerDirection2Towards(xs, zs, 0, 0, 1, Math.PI);
    expect(xs[0]).toBeCloseTo(0, 5);
    expect(zs[0]).toBeCloseTo(1, 5);
});
