import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    GameBuilder,
    Types,
    Update,
    defSystem,
    type Entity,
} from "@zero-ecs/game";
import { DevProfiler, Scheduler } from "@zero-ecs/game/advanced";

let ticks = 0;
const profiledSystem = defSystem(Update.fixed, () => { ticks++; }, []);

function createGame() {
    const builder = new GameBuilder();
    builder.addSystem(profiledSystem);
    const game = builder.build();
    game.init();
    game.start();
    return game;
}

function stageCalls(report: string, stage: string): number {
    const line = report.split("\n").find(value => value.startsWith(stage));
    if (!line) return 0;
    return Number(/\bcalls=(\d+)/.exec(line)?.[1] ?? 0);
}

class EmptyType implements Component<never> {}
class PartialType implements Component<0> { readonly 0 = Types.U32; }
class FullType implements Component<0> { readonly 0 = Types.U32; }
class SpareType implements Component<0> { readonly 0 = Types.U32; }

describe("DevProfiler", () => {
    test("observes only the target Game without patching Scheduler.prototype", () => {
        const originalRun = Scheduler.prototype.run;
        const firstGame = createGame();
        const secondGame = createGame();
        const first = new DevProfiler(firstGame);
        const second = new DevProfiler(secondGame);

        firstGame.update();
        expect(stageCalls(first.getPerformanceReport(), "fixed")).toBe(1);
        expect(stageCalls(second.getPerformanceReport(), "fixed")).toBe(0);
        expect(Scheduler.prototype.run).toBe(originalRun);

        secondGame.update();
        expect(stageCalls(first.getPerformanceReport(), "fixed")).toBe(1);
        expect(stageCalls(second.getPerformanceReport(), "fixed")).toBe(1);

        first.dispose();
        second.dispose();
        firstGame.dispose();
        secondGame.dispose();
        expect(Scheduler.prototype.run).toBe(originalRun);
    });

    test("keeps multiple profilers independent and disposes them in any order", () => {
        const game = createGame();
        const first = new DevProfiler(game);
        const second = new DevProfiler(game);

        game.update();
        expect(stageCalls(first.getPerformanceReport(), "fixed")).toBe(1);
        expect(stageCalls(second.getPerformanceReport(), "fixed")).toBe(1);

        first.dispose();
        first.dispose();
        game.update();
        expect(stageCalls(first.getPerformanceReport(), "fixed")).toBe(1);
        expect(stageCalls(second.getPerformanceReport(), "fixed")).toBe(2);

        second.dispose();
        game.update();
        expect(stageCalls(second.getPerformanceReport(), "fixed")).toBe(2);
        game.dispose();
    });

    test("reports empty, partial, full and spare Chunk utilization", () => {
        const game = createGame();
        const world = game.world;

        const emptyMeta = world.component(EmptyType);
        world.getOrCreateArchetype(emptyMeta.mask, [emptyMeta]);

        const partialMeta = world.component(PartialType);
        const partial = world.getOrCreateArchetype(partialMeta.mask, [partialMeta]);
        partial.insert(1 as Entity);

        const fullMeta = world.component(FullType);
        const full = world.getOrCreateArchetype(fullMeta.mask, [fullMeta]);
        for (let i = 0; i < full.chunkCapacity; i++) full.insert((i + 1) as Entity);

        const spareMeta = world.component(SpareType);
        const spare = world.getOrCreateArchetype(spareMeta.mask, [spareMeta]);
        spare.setSpareChunkLimit(1);
        for (let i = 0; i <= spare.chunkCapacity; i++) spare.insert((i + 1) as Entity);
        spare.remove(spare.locationAt(1, 0));

        const profiler = new DevProfiler(game);
        const lines = profiler.getMemoryReport().split("\n");
        const lineOf = (name: string): string =>
            lines.find(line => line.includes(name)) ?? "";

        expect(lineOf("EmptyType")).toContain("0/0/0(0)");
        expect(lineOf("EmptyType")).toContain("n/a");
        expect(lineOf("PartialType")).toContain("1/1/0(0)");
        expect(lineOf("FullType")).toContain("100.0%");
        expect(lineOf("SpareType")).toContain("1/2/1(1)");
        expect(lineOf("SpareType")).toContain("50.0%");
        expect(lines[lines.length - 1]).toContain("chunks=3/4/1");

        profiler.dispose();
        game.dispose();
    });
});
