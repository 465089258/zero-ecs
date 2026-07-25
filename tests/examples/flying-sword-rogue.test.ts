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
