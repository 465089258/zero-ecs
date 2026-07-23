import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    Command,
    CommandModule,
    Commands,
    DefaultCoreModule,
    GameBuilder,
    ErrorHandlerService,
    Service,
    Types,
} from "@zero-ecs/game";
import { EventArgs, EventModule, EventService } from "@zero-ecs/game/event";
import { RandomModule, RandomService } from "@zero-ecs/game/random";
import { FixedTimeResource, TimeModule, TimeState } from "@zero-ecs/game/time";
import { TimerConfigResource, TimerModule, TimerService } from "@zero-ecs/game/timer";

const enum Position { x }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

class PingEvent extends EventArgs {
    value = 0;
    set(value: number): this { this.assertMutable(); this.value = value; return this; }
    clear(): void { this.value = 0; }
}

class EmitPingCommand extends Command {
    @Service.inject(EventService) private readonly events!: EventService;
    value = 0;

    set(value: number): this { this.assertMutable(); this.value = value; return this; }
    execute(): void { this.events.event(PingEvent).set(this.value).post(); }
    protected clear(): void { this.value = 0; }
}

let reentrantCommandCalls = 0;
class ReentrantCommand extends Command {
    @Service.inject(Commands) private readonly commands!: Commands;
    private remaining = 0;

    set(remaining: number): this { this.assertMutable(); this.remaining = remaining; return this; }
    execute(): void {
        reentrantCommandCalls++;
        if (this.remaining > 1) {
            this.commands.command(ReentrantCommand).set(this.remaining - 1).submit();
        }
    }
    protected clear(): void { this.remaining = 0; }
}

function start(builder: GameBuilder) {
    const ecs = builder.build();
    ecs.init();
    ecs.start();
    return ecs;
}

describe("fixed time and optional features", () => {
    test("DefaultCoreModule installs the standard Game infrastructure", () => {
        const ecs = start(new GameBuilder().addModule(
            new DefaultCoreModule(new FixedTimeResource(0.25)),
        ));

        ecs.service(Commands);
        ecs.service(EventService);
        ecs.service(RandomService);
        ecs.service(TimerService);
        ecs.update();

        expect(ecs.state(TimeState).tick).toBe(1);
        expect(ecs.state(TimeState).delta).toBe(0.25);
        ecs.dispose();
    });

    test("advances deterministic TimeState without reading wall clock", () => {
        const ecs = start(new GameBuilder().addModule(
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
        const ecs = start(new GameBuilder()
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
        const ecs = start(new GameBuilder()
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

    test("validates Timer targets and creates enough levels for a large delay", () => {
        const ecs = start(new GameBuilder()
            .addModule(new TimeModule(new FixedTimeResource(1)))
            .addModule(new TimerModule()));
        const timer = ecs.service(TimerService);

        expect(() => timer.once(Number.NaN, { submit(): void {} })).toThrow(/finite/);
        expect(() => timer.once(-1, { submit(): void {} })).toThrow(/non-negative/);
        timer.once(64 ** 3 + 1, { submit(): void {} });
        expect((timer as unknown as { _state: { levels: unknown[] } })._state.levels.length).toBe(4);
        ecs.dispose();
    });

    test("uses a build-time TimerConfigResource instead of fixed package constants", () => {
        const config = new TimerConfigResource({ slotCount: 8, maxTaskPoolSize: 2 });
        const ecs = start(new GameBuilder()
            .addModule(new TimeModule(new FixedTimeResource(1)))
            .addModule(new TimerModule(config)));
        expect(ecs.resource(TimerConfigResource)).toBe(config);
        expect(config.slotMask).toBe(7);
        expect(() => new TimerConfigResource({ slotCount: 7 })).toThrow(/power-of-two/);
        expect(() => new TimerConfigResource({ maxTaskPoolSize: -1 })).toThrow(/non-negative/);
        ecs.dispose();
    });

    test("can delay an EntityCommand until a later fixed tick", () => {
        const ecs = start(new GameBuilder()
            .addModule(new CommandModule())
            .addModule(new TimeModule(new FixedTimeResource(0.02)))
            .addModule(new TimerModule()));
        const commands = ecs.service(Commands);
        const entities = ecs.world;
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
        const ecs = start(new GameBuilder()
            .addModule(new TimeModule())
            .addModule(new TimerModule()));
        let calls = 0;
        ecs.service(TimerService).once(1, { submit(): void { calls++; } });
        ecs.dispose();
        expect(calls).toBe(0);
    });

    test("flushes Events last in Post and defers recursively posted events", () => {
        const ecs = start(new GameBuilder().addModule(new EventModule()));
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

    test("uses Post dependencies instead of Module registration order", () => {
        const ecs = start(new GameBuilder()
            .addModule(new EventModule())
            .addModule(new CommandModule()));
        const values: number[] = [];
        ecs.service(EventService).on(PingEvent, event => values.push(event.value));
        ecs.service(Commands).command(EmitPingCommand).set(7).submit();

        ecs.update();

        expect(values).toEqual([7]);
        ecs.dispose();
    });

    test("retains commands beyond the re-entrant safety limit for the next Tick", () => {
        reentrantCommandCalls = 0;
        const errors: string[] = [];
        const ecs = start(new GameBuilder().addModule(new CommandModule()));
        ecs.service(ErrorHandlerService).setHandler((_error, source) => { errors.push(source); });
        ecs.service(Commands).command(ReentrantCommand).set(1001).submit();

        ecs.update();
        expect(reentrantCommandCalls).toBe(1000);
        expect(errors).toEqual(["command"]);
        ecs.update();
        expect(reentrantCommandCalls).toBe(1001);
        ecs.dispose();
    });

    test("Event cleanup processes the remaining queue after a fatal error handler", () => {
        const ecs = start(new GameBuilder().addModule(new EventModule()));
        const events = ecs.service(EventService);
        const received: number[] = [];
        events.on(PingEvent, event => {
            if (event.value === 1) throw new Error("listener failed");
            received.push(event.value);
        });
        ecs.service(ErrorHandlerService).setHandler(() => { throw new Error("fatal event handler"); });
        const first = events.event(PingEvent).set(1);
        const second = events.event(PingEvent).set(2);
        first.post();
        second.post();

        expect(() => ecs.update()).toThrow(/fatal event handler/);
        expect(received).toEqual([2]);
        expect(() => first.set(3)).toThrow(/recycled/);
        expect(() => second.set(3)).toThrow(/recycled/);
        ecs.dispose();
    });

    test("Timer cleanup processes every ready task after a fatal error handler", () => {
        const ecs = start(new GameBuilder()
            .addModule(new TimeModule(new FixedTimeResource(1)))
            .addModule(new TimerModule()));
        let attempts = 0;
        ecs.service(ErrorHandlerService).setHandler(() => { throw new Error("fatal timer handler"); });
        const timer = ecs.service(TimerService);
        timer.once(0, { submit(): void { attempts++; throw new Error("task failed"); } });
        timer.once(0, { submit(): void { attempts++; throw new Error("task failed"); } });

        expect(() => ecs.update()).toThrow(/fatal timer handler/);
        expect(attempts).toBe(2);
        ecs.dispose();
    });

    test("guards EventArgs lifecycle and never loans the same pooled instance twice", () => {
        const ecs = start(new GameBuilder().addModule(new EventModule()));
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
        const ecs = start(new GameBuilder().addModule(new EventModule()));
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
        const first = start(new GameBuilder().addModule(new RandomModule())).service(RandomService);
        const second = start(new GameBuilder().addModule(new RandomModule())).service(RandomService);
        first.seed(12345);
        second.seed(12345);
        const firstValues = [first.int(), first.int(), first.float(), first.int(10, 20)];
        const secondValues = [second.int(), second.int(), second.float(), second.int(10, 20)];
        expect(firstValues).toEqual(secondValues);
    });

    test("initializes RandomService and selects every positive weighted branch", () => {
        const random = start(new GameBuilder().addModule(new RandomModule())).service(RandomService);
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
