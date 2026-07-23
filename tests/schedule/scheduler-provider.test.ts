import { expect, test } from "@rstest/core";
import {
    ScheduleBuilder,
    Scheduler,
    Stage,
    SystemSet,
    type SystemParamProvider,
} from "@zero-ecs/scheduler";

type TestParam = "value" | "other";

class CountingProvider implements SystemParamProvider<TestParam> {
    calls = 0;

    constructor(
        private readonly value: Readonly<{ value: number }>,
        private readonly failAt = Number.POSITIVE_INFINITY,
    ) {}

    resolve(_param: TestParam): unknown {
        this.calls++;
        if (this.calls === this.failAt) throw new Error("expected prepare failure");
        return this.value;
    }
}

test("Scheduler resolves each opaque parameter once during prepare", () => {
    const fixed = new Stage("fixed", 0);
    let total = 0;
    const schedule = new ScheduleBuilder<TestParam>();
    schedule.addSystem(fixed, (value: Readonly<{ value: number }>) => {
        total += value.value;
    }, ["value"]);
    const scheduler = new Scheduler(schedule.build());
    const provider = new CountingProvider({ value: 3 });

    scheduler.init();
    expect(() => scheduler.run(fixed)).toThrow(/not been prepared/);
    scheduler.prepare(provider);
    scheduler.run(fixed);
    scheduler.run(fixed);

    expect(total).toBe(6);
    expect(provider.calls).toBe(1);
    expect(() => scheduler.prepare(provider)).toThrow(/cannot prepare/);
});

test("Scheduler prebinds 0 through 8 arguments and preserves the fallback call", () => {
    const fixed = new Stage("fixed", 0);
    const schedule = new ScheduleBuilder<number>();
    const calls: number[][] = [];
    let zeroThis: unknown = null;
    schedule.addSystem(fixed, function zero(this: unknown) {
        zeroThis = this;
        calls.push([]);
    }, []);
    for (let arity = 0; arity <= 9; arity++) {
        const params = Array.from({ length: arity }, (_, index) => index + 1);
        schedule.addSystem(fixed, (...values: number[]) => calls.push(values), params);
    }
    const scheduler = new Scheduler(schedule.build());
    scheduler.init();
    scheduler.prepare({ resolve: value => value });
    scheduler.run(fixed);

    expect(zeroThis).toBe(undefined);
    expect(calls).toEqual([
        [],
        ...Array.from(
            { length: 10 },
            (_, arity) => Array.from({ length: arity }, (_, index) => index + 1),
        ),
    ]);
});

test("Scheduler prepare failure publishes no partial runtime and is terminal", () => {
    const first = new Stage("first", 0);
    const fixed = new Stage("fixed", 1);
    const schedule = new ScheduleBuilder<TestParam>();
    schedule.addSystem(first, (_value: unknown) => {}, ["value"]);
    schedule.addSystem(fixed, (_value: unknown) => {}, ["other"]);
    const scheduler = new Scheduler(schedule.build());
    const provider = new CountingProvider({ value: 1 }, 2);

    scheduler.init();
    expect(() => scheduler.prepare(provider)).toThrow(/expected prepare failure/);
    expect(provider.calls).toBe(2);
    expect(() => scheduler.run(first)).toThrow(/not been prepared/);
    expect(() => scheduler.prepare(provider)).toThrow(/PrepareFailed/);

    scheduler.dispose();
    scheduler.dispose();
});

test("SystemSet expands to stable graph edges and rejects cross-stage use", () => {
    const post = new Stage("post", 0);
    const other = new Stage("other", 1);
    const producers = new SystemSet(post, "producers");
    const order: string[] = [];
    const schedule = new ScheduleBuilder<string>();
    schedule.addSystem(post, () => order.push("consumer"), [], { after: producers });
    schedule.addSystem(post, () => order.push("producer"), [], { inSet: producers });
    const scheduler = new Scheduler(schedule.build());
    scheduler.init();
    scheduler.prepare({ resolve: value => value });
    scheduler.run(post);
    expect(order).toEqual(["producer", "consumer"]);

    const invalidSet = new SystemSet(other, "invalid");
    const invalid = new ScheduleBuilder();
    expect(() => invalid.addSystem(post, () => {}, [], { inSet: invalidSet })).toThrow(/different Stage/);

    const crossStage = new ScheduleBuilder();
    const first = crossStage.addSystem(post, () => {}, []);
    const second = crossStage.addSystem(other, () => {}, []);
    crossStage.before(first, second);
    expect(() => crossStage.build()).toThrow(/Cross-stage dependency/);
});

test("strict empty SystemSet dependencies fail while optional dependencies stay no-op", () => {
    const update = new Stage("update", 0);
    const empty = new SystemSet(update, "empty");

    const strict = new ScheduleBuilder();
    const strictSystem = strict.addSystem(update, () => {}, []);
    strict.after(strictSystem, empty);
    expect(() => strict.build()).toThrow(/SystemSet empty has no registered systems/);

    const optional = new ScheduleBuilder();
    const optionalSystem = optional.addSystem(update, () => {}, []);
    optional.afterIfPresent(optionalSystem, empty);
    const scheduler = new Scheduler(optional.build());
    scheduler.init();
    scheduler.prepare({ resolve: value => value });
    expect(() => scheduler.run(update)).not.toThrow();
});

test("SystemHandle ownership uses object identity without builder metadata", () => {
    const update = new Stage("update", 0);
    const left = new ScheduleBuilder();
    const right = new ScheduleBuilder();
    const leftHandle = left.addSystem(update, () => {}, []);
    const rightHandle = right.addSystem(update, () => {}, []);

    expect(leftHandle.id).toBe(rightHandle.id);
    right.before(rightHandle, leftHandle);
    expect(() => right.build()).toThrow(/does not belong to this builder/);
    expect("__builderId" in leftHandle).toBe(false);
    expect("__builderId" in rightHandle).toBe(false);
});

test("cycle diagnostics report the real cycle without downstream nodes", () => {
    const update = new Stage("update", 0);
    const schedule = new ScheduleBuilder();
    function first(): void {}
    function second(): void {}
    function downstream(): void {}
    const firstHandle = schedule.addSystem(update, first, []);
    const secondHandle = schedule.addSystem(update, second, []);
    const downstreamHandle = schedule.addSystem(update, downstream, []);
    schedule
        .before(firstHandle, secondHandle)
        .before(secondHandle, firstHandle)
        .before(secondHandle, downstreamHandle);

    const scheduler = new Scheduler(schedule.build());
    let message = "";
    try {
        scheduler.init();
    } catch (error) {
        message = String(error);
    }
    expect(message).toMatch(/System dependency cycle detected: first -> second -> first/);
    expect(message).not.toContain("downstream");
});
