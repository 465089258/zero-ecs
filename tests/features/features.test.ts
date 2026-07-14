import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    CommandModule,
    CommandService,
    EcsBuilder,
    EntityService,
    EventArgs,
    EventModule,
    EventService,
    FixedTimeResource,
    RandomModule,
    RandomService,
    TimeModule,
    TimeState,
    TimerModule,
    TimerService,
    Types,
} from "../../src";

const enum Position { x }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

class PingEvent extends EventArgs {
    value = 0;
    set(value: number): this { this.assertMutable(); this.value = value; return this; }
    clear(): void { this.value = 0; }
}

function start(builder: EcsBuilder) {
    const ecs = builder.build();
    ecs.init();
    ecs.start();
    return ecs;
}

describe("fixed time and optional features", () => {
    test("advances deterministic TimeState without reading wall clock", () => {
        const ecs = start(new EcsBuilder().addModule(
            new TimeModule(new FixedTimeResource(0.25)),
        ));

        ecs.update();
        ecs.update();
        ecs.update();

        const time = ecs.state(TimeState);
        expect(time.delta).toBe(0.25);
        expect(time.elapsed).toBe(0.75);
        expect(time.tick).toBe(3);
    });

    test("fires Timer tasks on deterministic ticks", () => {
        const ecs = start(new EcsBuilder()
            .addModule(new TimerModule())
            .addModule(new TimeModule(new FixedTimeResource(0.02))));
        const timer = ecs.service(TimerService);
        let calls = 0;
        timer.once(0.04, { submit(): void { calls++; } });

        ecs.update();
        expect(calls).toBe(0);
        ecs.update();
        expect(calls).toBe(1);
        ecs.update();
        expect(calls).toBe(1);
    });

    test("demotes hierarchical Timer tasks without wrapper nodes", () => {
        const ecs = start(new EcsBuilder()
            .addModule(new TimeModule(new FixedTimeResource(1)))
            .addModule(new TimerModule()));
        const timer = ecs.service(TimerService);
        let calls = 0;
        timer.once(65, { submit(): void { calls++; } });
        for (let i = 0; i < 64; i++) ecs.update();
        expect(calls).toBe(0);
        ecs.update();
        expect(calls).toBe(1);
        timer.trimPool(0);
        expect(() => timer.trimPool(-1)).toThrow(/non-negative/);
    });

    test("can delay an EntityCommand until a later fixed tick", () => {
        const ecs = start(new EcsBuilder()
            .addModule(new CommandModule())
            .addModule(new TimeModule(new FixedTimeResource(0.02)))
            .addModule(new TimerModule()));
        const commands = ecs.service(CommandService);
        const entities = ecs.service(EntityService);
        const timer = ecs.service(TimerService);
        const command = commands.spawn().set(PositionType, Position.x, 7);
        const entity = command.entity;
        timer.once(0.04, command);

        ecs.update();
        expect(entities.valid(entity)).toBe(true);
        expect(entities.has(entity, PositionType)).toBe(false);
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(7);
    });

    test("does not auto-submit a pending Timer task during dispose", () => {
        const ecs = start(new EcsBuilder()
            .addModule(new TimeModule())
            .addModule(new TimerModule()));
        let calls = 0;
        ecs.service(TimerService).once(1, { submit(): void { calls++; } });
        ecs.dispose();
        expect(calls).toBe(0);
    });

    test("flushes Events last in Post and defers recursively posted events", () => {
        const ecs = start(new EcsBuilder().addModule(new EventModule()));
        const events = ecs.service(EventService);
        const values: number[] = [];
        events.on(PingEvent, event => {
            values.push(event.value);
            if (event.value === 1) events.event(PingEvent).set(2).post();
        });
        events.event(PingEvent).set(1).post();

        ecs.update();
        expect(values).toEqual([1]);
        ecs.update();
        expect(values).toEqual([1, 2]);
    });

    test("guards EventArgs lifecycle and never loans the same pooled instance twice", () => {
        const ecs = start(new EcsBuilder().addModule(new EventModule()));
        const events = ecs.service(EventService);
        const event = events.event(PingEvent).set(1);
        event.post();

        expect(() => event.post()).toThrow(/already been posted/);
        expect(() => event.set(2)).toThrow(/already been posted/);
        ecs.update();
        expect(() => event.set(3)).toThrow(/already been recycled/);

        const first = events.event(PingEvent);
        const second = events.event(PingEvent);
        expect(first).not.toBe(second);
        first.post();
        second.post();
        ecs.update();
        ecs.dispose();
    });

    test("trims pooled EventArgs at an explicit boundary", () => {
        const ecs = start(new EcsBuilder().addModule(new EventModule()));
        const events = ecs.service(EventService);
        const first = events.event(PingEvent);
        const second = events.event(PingEvent);
        first.post();
        second.post();
        ecs.update();

        events.trimPools(1);
        const retained = events.event(PingEvent);
        const created = events.event(PingEvent);
        expect(retained).toBe(first);
        expect(created).not.toBe(first);
        expect(created).not.toBe(second);
        retained.post();
        created.post();
        ecs.update();
    });

    test("produces the same RandomService sequence for the same seed", () => {
        const first = start(new EcsBuilder().addModule(new RandomModule())).service(RandomService);
        const second = start(new EcsBuilder().addModule(new RandomModule())).service(RandomService);
        first.seed(12345);
        second.seed(12345);
        const firstValues = [first.int(), first.int(), first.float(), first.int(10, 20)];
        const secondValues = [second.int(), second.int(), second.float(), second.int(10, 20)];
        expect(firstValues).toEqual(secondValues);
    });

    test("initializes RandomService and selects every positive weighted branch", () => {
        const random = new RandomService();
        expect(random.float()).toBeGreaterThan(0);

        random.seed(123);
        const values = new Set<string>();
        for (let i = 0; i < 100; i++) values.add(random.weight([[1, "a"], [1, "b"]]));
        expect(values).toEqual(new Set(["a", "b"]));
        expect(() => random.elem([])).toThrow(/non-empty/);
        expect(() => random.weight([[0, "invalid"]])).toThrow(/positive weights/);
        expect(() => random.seed(Number.NaN)).toThrow(/finite/);
    });
});
