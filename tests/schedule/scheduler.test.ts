import { describe, expect, test } from "@rstest/core";
import * as publicApi from "../../src";
import { EntityMigrationService } from "../../src/ecs/migration/entity-migration-service";
import type { Scheduler } from "../../src/schedule/scheduler";
import {
    CommandModule,
    Command,
    CommandService,
    type Component,
    EcsBuilder,
    EcsPhase,
    EventModule,
    EventService,
    Write,
    type Mut,
    Query,
    QueryType,
    Resource,
    Service,
    State,
    Types,
    Update,
    With,
    World,
} from "../../src";

class StepResource extends Resource {
    constructor(readonly value: number) { super(); }
}

class ClockState extends State { readonly time: number = 0; }
class TimerState extends State { readonly observed: number = 0; }

class AuditService extends Service {
    calls = 0;
    record(): void { this.calls++; }
}

const enum Position { x }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

describe("system registration and scheduling", () => {
    test("runs first/fixed/last before the private command/event Post partitions", () => {
        const order: string[] = [];
        const builder = new EcsBuilder();
        builder.addSystem(Update.first, () => order.push("first"), []);
        builder.addSystem(Update.fixed, () => order.push("fixed"), []);
        builder.addSystem(Update.last, () => order.push("last"), []);
        // Register in reverse commit order to verify internal partitions, not Module order.
        builder.addModule(new EventModule());
        builder.addModule(new CommandModule());
        const ecs = builder.build();
        ecs.service(CommandService).flush = () => { order.push("command"); };
        ecs.service(EntityMigrationService).flush = () => { order.push("migration"); };
        ecs.service(EventService).flush = () => { order.push("event"); };

        ecs.init();
        ecs.start();
        ecs.update();

        expect(Update.stages).toEqual([Update.first, Update.fixed, Update.last]);
        expect(order).toEqual(["first", "fixed", "last", "command", "migration", "event"]);
        expect("InternalPost" in publicApi).toBe(false);
        expect("EntityMigrationService" in publicApi).toBe(false);
        expect("EntityCommandService" in publicApi).toBe(false);
        expect("Bundle" in publicApi).toBe(false);
        expect("DataSet" in publicApi).toBe(false);
        expect("Mask" in publicApi).toBe(false);
        expect("Archetype" in publicApi).toBe(false);
    });

    test("injects peer World, Resource, State and Service parameters", () => {
        const order: string[] = [];
        let receivedWorld: World | undefined;

        function timeSystem(
            world: World,
            step: Readonly<StepResource>,
            time: Mut<ClockState>,
            audit: AuditService,
        ): void {
            receivedWorld = world;
            time.time += step.value;
            audit.record();
            order.push("time");
        }

        function timerSystem(time: Readonly<ClockState>, timer: Mut<TimerState>): void {
            timer.observed = time.time;
            order.push("timer");
        }

        const builder = new EcsBuilder();
        builder.addResource(StepResource, new StepResource(25));
        const time = builder.addSystem(Update.first, timeSystem, [
            World,
            StepResource,
            Write(ClockState),
            AuditService,
        ]);
        builder.addSystem(Update.last, timerSystem, [ClockState, Write(TimerState)], {
            after: timeSystem,
        });
        const ecs = builder.build();
        const scheduler = (ecs as unknown as { _scheduler: Scheduler })._scheduler;
        const access = scheduler.schedule.systems[time.id].access;
        expect(access.world).toBe(true);
        expect(access.reads.has(StepResource)).toBe(true);
        expect(access.reads.has(AuditService as never)).toBe(false);
        expect(access.writes.has(ClockState)).toBe(true);

        ecs.init();
        ecs.start();
        ecs.update();
        expect(receivedWorld).toBe(ecs.world);
        expect(order).toEqual(["time", "timer"]);
        expect(ecs.state(ClockState).time).toBe(25);
        expect(ecs.state(TimerState).observed).toBe(25);
        expect(ecs.service(AuditService).calls).toBe(1);
    });

    test("uses a stable topological order within a stage", () => {
        const order: string[] = [];
        function second(): void { order.push("second"); }
        function first(): void { order.push("first"); }
        const builder = new EcsBuilder();
        builder.addSystem(Update.fixed, second, [], { after: first });
        builder.addSystem(Update.fixed, first, []);
        const ecs = builder.build();
        ecs.init();
        ecs.start();
        ecs.update();
        expect(order).toEqual(["first", "second"]);
    });

    test("constructs Query parameters without Query access metadata", () => {
        const queryType = QueryType.from(With(PositionType));
        let received: Query<[PositionType]> | undefined;
        function querySystem(query: Query<[PositionType]>): void { received = query; }
        const builder = new EcsBuilder();
        const handle = builder.addSystem(Update.fixed, querySystem, [queryType]);
        const ecs = builder.build();
        const scheduler = (ecs as unknown as { _scheduler: Scheduler })._scheduler;
        const access = scheduler.schedule.systems[handle.id].access;
        expect(access.reads.size).toBe(0);
        expect(access.writes.size).toBe(0);
        expect(access.world).toBe(false);
        ecs.init();
        ecs.start();
        ecs.update();
        expect(received).toBeInstanceOf(Query);
    });

    test("rejects dependency cycles, missing Resources and Mut(Service)", () => {
        function a(): void {}
        function b(): void {}
        const builder = new EcsBuilder();
        const ah = builder.addSystem(Update.fixed, a, []);
        const bh = builder.addSystem(Update.fixed, b, []);
        builder.before(ah, bh).before(bh, ah);
        const ecs = builder.build();
        expect(() => ecs.init()).toThrow(/dependency cycle/);
        expect(() => Write(AuditService as never)).toThrow(/only accepts a State/);

        const missing = new EcsBuilder();
        missing.addSystem(Update.fixed, (_step: Readonly<StepResource>) => {}, [StepResource]);
        expect(() => missing.build()).toThrow(/Missing system Resources: StepResource/);
    });

    test("stops after a failed Tick and discards deferred Commands during dispose", () => {
        class DeferredCommand extends Command {
            static executions = 0;
            execute(): void { DeferredCommand.executions++; }
        }

        function failingSystem(commands: CommandService): void {
            commands.cmd(DeferredCommand).submit();
            throw new Error("expected system failure");
        }

        DeferredCommand.executions = 0;
        const builder = new EcsBuilder().addModule(new CommandModule());
        builder.addSystem(Update.fixed, failingSystem, [CommandService]);
        const ecs = builder.build();
        ecs.init();
        ecs.start();

        expect(() => ecs.update()).toThrow(/expected system failure/);
        expect(ecs.phase).toBe(EcsPhase.Stopped);
        expect(() => ecs.update()).toThrow(/invalid during phase Stopped/);
        ecs.dispose();
        expect(DeferredCommand.executions).toBe(0);
    });
});
