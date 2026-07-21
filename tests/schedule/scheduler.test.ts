import { describe, expect, test } from "@rstest/core";
import * as publicApi from "@zero-ecs/game";
import {
    Allocator,
    CommandModule,
    Command,
    Commands,
    defSystem,
    type Component,
    GameBuilder,
    GamePhase,
    ManualStage,
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
    type WorldView,
} from "@zero-ecs/game";

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
    test("manual stages run only when explicitly requested", () => {
        const Render = new ManualStage("render", 10);
        const order: string[] = [];
        const builder = new GameBuilder();
        builder.addSystem(defSystem(Render, () => order.push("render"), []));
        builder.addSystem(defSystem(Update.fixed, () => order.push("fixed"), []));
        const game = builder.build();

        expect(() => game.runStage(Render)).toThrow(/invalid during phase Built/);
        game.init();
        game.start();
        game.update();
        expect(order).toEqual(["fixed"]);
        game.runStage(Render);
        expect(order).toEqual(["fixed", "render"]);
        game.dispose();
    });

    test("runs first/fixed/last/post and orders Post systems by dependencies", () => {
        const order: string[] = [];
        const builder = new GameBuilder();
        builder.addSystem(defSystem(Update.first, () => order.push("first"), []));
        builder.addSystem(defSystem(Update.fixed, () => order.push("fixed"), []));
        builder.addSystem(defSystem(Update.last, () => order.push("last"), []));
        const command = defSystem(Update.post, () => order.push("command"), []);
        const migration = defSystem(Update.post, () => order.push("migration"), []);
        const event = defSystem(Update.post, () => order.push("event"), []);
        // Reverse registration proves that the graph, rather than registration order, decides Post order.
        builder.addSystem(event, { after: migration });
        builder.addSystem(migration, { after: command });
        builder.addSystem(command);
        const ecs = builder.build();

        ecs.init();
        ecs.start();
        ecs.update();

        expect(Update.stages).toEqual([Update.first, Update.fixed, Update.last, Update.post]);
        expect(order).toEqual(["first", "fixed", "last", "command", "migration", "event"]);
        expect("InternalPost" in publicApi).toBe(false);
        expect("EntityMigrationService" in publicApi).toBe(false);
        expect("CommandState" in publicApi).toBe(false);
        expect("EntityMigrationState" in publicApi).toBe(false);
        expect("EventState" in publicApi).toBe(false);
        expect("TimerState" in publicApi).toBe(false);
        expect("RandomState" in publicApi).toBe(false);
        expect("EcsMemoryState" in publicApi).toBe(false);
        expect("CommandPoolService" in publicApi).toBe(false);
        expect("EntityMigrationPoolService" in publicApi).toBe(false);
        expect("EventPoolService" in publicApi).toBe(false);
        expect("TimerPoolService" in publicApi).toBe(false);
        expect("EntityCommands" in publicApi).toBe(false);
        expect("Bundle" in publicApi).toBe(false);
        expect("DataSet" in publicApi).toBe(false);
        expect("Mask" in publicApi).toBe(false);
        expect("Archetype" in publicApi).toBe(false);
    });

    test("optional dependencies apply when present and do not require optional Modules", () => {
        const absentOrder: string[] = [];
        const optionalTarget = defSystem(Update.post, () => absentOrder.push("target"), []);
        const optionalFollower = defSystem(Update.post, () => absentOrder.push("follower"), []);
        const absent = new GameBuilder();
        absent.addSystem(optionalFollower, { afterIfPresent: optionalTarget });
        const absentGame = absent.build();
        absentGame.init();
        absentGame.start();
        absentGame.update();
        expect(absentOrder).toEqual(["follower"]);
        absentGame.dispose();

        const presentOrder: string[] = [];
        const target = defSystem(Update.post, () => presentOrder.push("target"), []);
        const follower = defSystem(Update.post, () => presentOrder.push("follower"), []);
        const present = new GameBuilder();
        present.addSystem(follower, { afterIfPresent: target });
        present.addSystem(target);
        const presentGame = present.build();
        presentGame.init();
        presentGame.start();
        presentGame.update();
        expect(presentOrder).toEqual(["target", "follower"]);
        presentGame.dispose();

        const strict = new GameBuilder();
        strict.addSystem(follower, { after: target });
        expect(() => strict.build()).toThrow(/is not registered/);
    });

    test("injects peer World, Resource, State and Service parameters", () => {
        const order: string[] = [];
        let receivedWorld: WorldView | undefined;

        function timeSystem(
            world: WorldView,
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

        const builder = new GameBuilder();
        builder.addResource(StepResource, new StepResource(25));
        builder.addState(ClockState);
        builder.addState(TimerState);
        builder.addService(AuditService);
        const definedTime = defSystem(Update.first, timeSystem, [
            World,
            StepResource,
            Write(ClockState),
            AuditService,
        ]);
        builder.addSystem(definedTime);
        builder.addSystem(defSystem(Update.last, timerSystem, [ClockState, Write(TimerState)]));
        const ecs = builder.build();
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
        const builder = new GameBuilder();
        const firstSystem = defSystem(Update.fixed, first, []);
        builder.addSystem(defSystem(Update.fixed, second, []), { after: firstSystem });
        builder.addSystem(firstSystem);
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
        const builder = new GameBuilder();
        builder.addSystem(defSystem(Update.fixed, querySystem, [queryType]));
        const ecs = builder.build();
        ecs.init();
        ecs.start();
        ecs.update();
        expect(received).toBeInstanceOf(Query);
    });

    test("resolves repeated Query tokens as independent nested Query instances", () => {
        const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
        const queryType = QueryType.from(With(PositionType));
        let outerQuery: Query<[PositionType]> | undefined;
        let innerQuery: Query<[PositionType]> | undefined;
        let pairs = 0;
        function querySystem(outer: Query<[PositionType]>, inner: Query<[PositionType]>): void {
            outerQuery = outer;
            innerQuery = inner;
            const outerIter = outer.iter();
            while (outerIter.next()) {
                const outerCount = outerIter.current[0];
                const innerIter = inner.iter();
                while (innerIter.next()) pairs += outerCount * innerIter.current[0];
            }
        }

        const builder = new GameBuilder().setAllocator(allocator);
        builder.addSystem(defSystem(Update.fixed, querySystem, [queryType, queryType]));
        const game = builder.build();
        const world = game.structureWriter() as World;
        const entityCount = 24;
        for (let i = 0; i < entityCount; i++) {
            const entity = world.reserveEntity();
            expect(world.applyEntityCommand(
                world.createEntityCommand(entity).add(PositionType).set(PositionType, Position.x, i),
            )).toBe(true);
        }

        game.init();
        game.start();
        game.update();

        expect(outerQuery).not.toBe(innerQuery);
        expect(outerQuery?.iter()).not.toBe(innerQuery?.iter());
        expect(pairs).toBe(entityCount * entityCount);
        game.dispose();
        allocator.clear();
    });

    test("continues to reject repeated non-Query parameters", () => {
        const builder = new GameBuilder();
        const system = defSystem(Update.fixed, (_first: Readonly<ClockState>, _second: Readonly<ClockState>) => {}, [
            ClockState,
            ClockState,
        ]);
        expect(() => builder.addSystem(system)).toThrow(/ClockState is declared more than once/);
    });

    test("system parameters do not register State or Service types", () => {
        const builder = new GameBuilder();
        builder.addSystem(defSystem(
            Update.fixed,
            (_clock: Readonly<ClockState>, _audit: AuditService) => {},
            [ClockState, AuditService],
        ));
        const game = builder.build();

        expect(() => game.state(ClockState)).toThrow(/Instance not found: ClockState/);
        expect(() => game.service(AuditService)).toThrow(/Instance not found: AuditService/);
        game.dispose();
    });

    test("rejects dependency cycles, missing Resources and Mut(Service)", () => {
        function a(): void {}
        function b(): void {}
        const builder = new GameBuilder();
        const ah = builder.addSystem(defSystem(Update.fixed, a, []));
        const bh = builder.addSystem(defSystem(Update.fixed, b, []));
        builder.before(ah, bh).before(bh, ah);
        const ecs = builder.build();
        expect(() => ecs.init()).toThrow(/dependency cycle/);
        expect(() => Write(AuditService as never)).toThrow(/only accepts a State/);

        const missing = new GameBuilder();
        missing.addSystem(defSystem(Update.fixed, (_step: Readonly<StepResource>) => {}, [StepResource]));
        const missingGame = missing.build();
        missingGame.init();
        expect(() => missingGame.start()).toThrow(/Instance not found: StepResource/);
        missingGame.dispose();
    });

    test("stops after a failed Tick and discards deferred Commands during dispose", () => {
        class DeferredCommand extends Command {
            static executions = 0;
            execute(): void { DeferredCommand.executions++; }
        }

        function failingSystem(commands: Commands): void {
            commands.cmd(DeferredCommand).submit();
            throw new Error("expected system failure");
        }

        DeferredCommand.executions = 0;
        const builder = new GameBuilder().addModule(new CommandModule());
        builder.addSystem(defSystem(Update.fixed, failingSystem, [Commands]));
        const ecs = builder.build();
        ecs.init();
        ecs.start();

        expect(() => ecs.update()).toThrow(/expected system failure/);
        expect(ecs.phase).toBe(GamePhase.Stopped);
        expect(() => ecs.update()).toThrow(/invalid during phase Stopped/);
        ecs.dispose();
        expect(DeferredCommand.executions).toBe(0);
    });
});
