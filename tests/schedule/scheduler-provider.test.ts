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
