import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
    Command,
    CommandModule,
    Commands,
    defSystem,
    GameBuilder,
    Types,
    Update,
} from "@zero-ecs/game";
import { EventArgs, EventModule, EventService } from "@zero-ecs/game/event";
import { FixedTimeResource, TimeModule } from "@zero-ecs/game/time";
import { TimerModule, TimerService } from "@zero-ecs/game/timer";
import { ScheduleBuilder, Scheduler, Stage } from "@zero-ecs/scheduler";
import { Allocator, QueryType, With, World } from "@zero-ecs/world";

const CONFIG_URL = new URL("./config.v1.json", import.meta.url);
let checksum = 0;

class BenchPosition { 0 = Types.F32; }
class ChurnA { 0 = Types.U32; }
class ChurnB { 0 = Types.U32; }
class BenchCommand extends Command {
    execute() { checksum++; }
}
class BenchEvent extends EventArgs {}

export async function loadBenchmarkConfig(profileName) {
    const config = JSON.parse(await readFile(CONFIG_URL, "utf8"));
    const profile = config.profiles[profileName];
    if (!profile) throw new Error(`Unknown benchmark profile: ${profileName}`);
    return { schemaVersion: config.schemaVersion, profileName, ...profile };
}

export const scenarioNames = Object.freeze([
    "scheduler-0",
    "scheduler-1",
    "scheduler-4",
    "scheduler-direct-s1-a0",
    "scheduler-direct-s16-a0",
    "scheduler-direct-s16-a1",
    "scheduler-direct-s16-a4",
    "scheduler-direct-s16-a8",
    "scheduler-direct-s16-a9",
    "scheduler-direct-s64-a0",
    "world-valid",
    "world-get",
    "world-has",
    "query-stable-archetypes",
    "query-stable-chunks",
    "query-unmatched-churn",
    "chunk-boundary-spare-0",
    "chunk-boundary-spare-1",
    "commands",
    "events",
    "timers",
    "churn-a-b-a",
]);

export function createScenario(name, config) {
    const directScheduler = /^scheduler-direct-s(\d+)-a(\d+)$/.exec(name);
    if (directScheduler) {
        return createDirectSchedulerScenario(
            Number(directScheduler[1]),
            Number(directScheduler[2]),
            config,
        );
    }
    if (name.startsWith("scheduler-")) {
        return createSchedulerScenario(Number(name.slice("scheduler-".length)), config);
    }
    if (name.startsWith("world-")) return createWorldReadScenario(name, config);
    if (name === "query-stable-archetypes") return createStableArchetypeQueryScenario(config);
    if (name === "query-stable-chunks") return createStableChunkQueryScenario(config);
    if (name === "query-unmatched-churn") return createUnmatchedChunkChurnScenario(config);
    if (name === "chunk-boundary-spare-0") return createChunkBoundaryScenario(config, 0);
    if (name === "chunk-boundary-spare-1") return createChunkBoundaryScenario(config, 1);
    if (name === "commands") return createCommandScenario(config);
    if (name === "events") return createEventScenario(config);
    if (name === "timers") return createTimerScenario(config);
    if (name === "churn-a-b-a") return createChurnScenario(config);
    throw new Error(`Unknown benchmark scenario: ${name}`);
}

export function benchmarkChecksum() { return checksum; }

function createSchedulerScenario(systemCount, config) {
    const builder = new GameBuilder();
    for (let i = 0; i < systemCount; i++) {
        const system = function benchmarkNoopSystem() { checksum += 0; };
        builder.addSystem(defSystem(Update.fixed, system, []));
    }
    const game = start(builder);
    return {
        name: `scheduler-${systemCount}`,
        operations: config.schedulerUpdates,
        run() {
            for (let i = 0; i < config.schedulerUpdates; i++) game.update();
        },
        dispose() { game.dispose(); },
    };
}

function createDirectSchedulerScenario(systemCount, arity, config) {
    const stage = new Stage("benchmark", 0);
    const builder = new ScheduleBuilder();
    const params = Array.from({ length: arity }, (_, index) => index + 1);
    for (let systemIndex = 0; systemIndex < systemCount; systemIndex++) {
        builder.addSystem(
            stage,
            createAritySystem(arity, systemIndex),
            params,
        );
    }
    const scheduler = new Scheduler(builder.build());
    scheduler.init();
    scheduler.prepare({ resolve: value => value });
    const runs = Math.ceil(config.schedulerInvocations / systemCount);
    return {
        name: `scheduler-direct-s${systemCount}-a${arity}`,
        operations: runs * systemCount,
        run() {
            for (let i = 0; i < runs; i++) scheduler.run(stage);
        },
        dispose() { scheduler.dispose(); },
    };
}

function createAritySystem(arity, systemIndex) {
    const salt = systemIndex + 1;
    switch (arity) {
        case 0: return function schedulerArity0() { checksum += salt; };
        case 1: return function schedulerArity1(a0) { checksum += salt + a0; };
        case 4: return function schedulerArity4(a0, a1, a2, a3) {
            checksum += salt + a0 + a1 + a2 + a3;
        };
        case 8: return function schedulerArity8(a0, a1, a2, a3, a4, a5, a6, a7) {
            checksum += salt + a0 + a1 + a2 + a3 + a4 + a5 + a6 + a7;
        };
        case 9: return function schedulerArity9(a0, a1, a2, a3, a4, a5, a6, a7, a8) {
            checksum += salt + a0 + a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8;
        };
        default: throw new RangeError(`Unsupported Scheduler benchmark arity: ${arity}`);
    }
}

function createWorldReadScenario(name, config) {
    const allocator = new Allocator();
    const world = new World(allocator);
    const entities = new Uint32Array(config.readEntityCount);
    const position = world.component(BenchPosition);
    for (let i = 0; i < entities.length; i++) {
        const entity = world.spawn();
        entities[i] = entity;
        if (!world.migrate(entity, position.mask, [position], (archetype, row) => {
            archetype.setField(row, position.id, 0, i);
        })) throw new Error("World read setup failed");
    }
    const operations = config.readEntityCount * config.readPasses;
    let run;
    if (name === "world-valid") {
        run = () => {
            let value = 0;
            for (let pass = 0; pass < config.readPasses; pass++) {
                for (let i = 0; i < entities.length; i++) value += world.valid(entities[i]) ? 1 : 0;
            }
            checksum += value;
        };
    } else if (name === "world-get") {
        run = () => {
            let value = 0;
            for (let pass = 0; pass < config.readPasses; pass++) {
                for (let i = 0; i < entities.length; i++) value += world.get(entities[i], BenchPosition, 0) ?? 0;
            }
            checksum += value;
        };
    } else {
        run = () => {
            let value = 0;
            for (let pass = 0; pass < config.readPasses; pass++) {
                for (let i = 0; i < entities.length; i++) value += world.has(entities[i], BenchPosition) ? 1 : 0;
            }
            checksum += value;
        };
    }
    return {
        name,
        operations,
        run,
        dispose() {
            world.dispose();
            allocator.clear();
        },
    };
}

function createStableArchetypeQueryScenario(config) {
    const allocator = new Allocator();
    const world = new World(allocator);
    const position = world.component(BenchPosition);
    for (let i = 0; i < config.queryArchetypeCount; i++) {
        const Tag = class QueryBenchmarkTag { 0 = Types.U8; };
        const tag = world.component(Tag);
        world.getOrCreateArchetype(position.mask.or(tag.mask), [position, tag]).insert((i + 1) >>> 0);
    }
    const query = world.query(QueryType.from(With(BenchPosition)));
    return {
        name: "query-stable-archetypes",
        operations: config.queryArchetypeCount * config.queryPasses,
        run() {
            let count = 0;
            for (let pass = 0; pass < config.queryPasses; pass++) {
                const iter = query.iter();
                while (iter.next()) count += iter.current[0];
            }
            checksum += count;
        },
        dispose() {
            world.dispose();
            allocator.clear();
        },
    };
}

function createStableChunkQueryScenario(config) {
    const allocator = new Allocator();
    const world = new World(allocator);
    const position = world.component(BenchPosition);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);
    for (let i = 0; i < config.readEntityCount; i++) archetype.insert((i + 1) >>> 0);
    const query = world.query(QueryType.from(With(BenchPosition)));
    return {
        name: "query-stable-chunks",
        operations: config.readEntityCount * config.readPasses,
        run() {
            let count = 0;
            for (let pass = 0; pass < config.readPasses; pass++) {
                const iter = query.iter();
                while (iter.next()) count += iter.current[0];
            }
            checksum += count;
        },
        dispose() {
            world.dispose();
            allocator.clear();
        },
    };
}

function createUnmatchedChunkChurnScenario(config) {
    const allocator = new Allocator();
    const world = new World(allocator);
    const position = world.component(BenchPosition);
    const churn = world.component(ChurnA);
    world.getOrCreateArchetype(position.mask, [position]).insert(1);
    const unmatched = world.getOrCreateArchetype(churn.mask, [churn]);
    const query = world.query(QueryType.from(With(BenchPosition)));
    return {
        name: "query-unmatched-churn",
        operations: config.chunkCycles,
        run() {
            let count = 0;
            for (let cycle = 0; cycle < config.chunkCycles; cycle++) {
                const row = unmatched.insert(2);
                unmatched.remove(row);
                const iter = query.iter();
                while (iter.next()) count += iter.current[0];
            }
            checksum += count;
        },
        dispose() {
            world.dispose();
            allocator.clear();
        },
    };
}

function createChunkBoundaryScenario(config, spareChunkLimit) {
    const allocator = new Allocator();
    const world = new World(allocator);
    const position = world.component(BenchPosition);
    const archetype = world.getOrCreateArchetype(position.mask, [position]);
    archetype.setSpareChunkLimit(spareChunkLimit);
    for (let i = 0; i < archetype.chunkCapacity; i++) archetype.insert((i + 1) >>> 0);
    const query = world.query(QueryType.from(With(BenchPosition)));
    return {
        name: `chunk-boundary-spare-${spareChunkLimit}`,
        operations: config.chunkCycles,
        run() {
            let count = 0;
            for (let cycle = 0; cycle < config.chunkCycles; cycle++) {
                const row = archetype.insert(2);
                let iter = query.iter();
                while (iter.next()) count += iter.current[0];
                archetype.remove(row);
                iter = query.iter();
                while (iter.next()) count += iter.current[0];
            }
            checksum += count;
        },
        dispose() {
            world.dispose();
            allocator.clear();
        },
    };
}

function createCommandScenario(config) {
    const game = start(new GameBuilder().addModule(new CommandModule()));
    const commands = game.service(Commands);
    return {
        name: "commands",
        operations: config.queuedOperations,
        run() {
            for (let i = 0; i < config.queuedOperations; i++) {
                commands.command(BenchCommand).submit();
            }
            game.update();
        },
        dispose() { game.dispose(); },
    };
}

function createEventScenario(config) {
    const game = start(new GameBuilder().addModule(new EventModule()));
    const events = game.service(EventService);
    events.on(BenchEvent, () => { checksum++; });
    return {
        name: "events",
        operations: config.queuedOperations,
        run() {
            for (let i = 0; i < config.queuedOperations; i++) events.event(BenchEvent).post();
            game.update();
        },
        dispose() { game.dispose(); },
    };
}

function createTimerScenario(config) {
    const game = start(new GameBuilder()
        .addModule(new TimeModule(new FixedTimeResource(1)))
        .addModule(new TimerModule()));
    const timers = game.service(TimerService);
    const task = { submit() { checksum++; } };
    return {
        name: "timers",
        operations: config.queuedOperations,
        run() {
            for (let i = 0; i < config.queuedOperations; i++) timers.once(0, task);
            game.update();
        },
        dispose() { game.dispose(); },
    };
}

function createChurnScenario(config) {
    const game = start(new GameBuilder().addModule(new CommandModule()));
    const commands = game.service(Commands);
    const world = game.world;
    const entities = new Uint32Array(config.churnEntityCount);
    for (let i = 0; i < entities.length; i++) {
        const command = commands.spawn().add(ChurnA).set(ChurnA, 0, i);
        entities[i] = command.entity;
        command.submit();
    }
    game.update();

    const migrate = (from, to) => {
        for (let i = 0; i < entities.length; i++) {
            commands.entity(entities[i]).remove(from).add(to).set(to, 0, i).submit();
        }
        game.update();
    };
    const verify = (present, absent) => {
        for (let i = 0; i < entities.length; i++) {
            if (!world.has(entities[i], present) || world.has(entities[i], absent)) {
                throw new Error("Churn production preflight failed");
            }
        }
    };
    migrate(ChurnA, ChurnB);
    verify(ChurnB, ChurnA);
    migrate(ChurnB, ChurnA);
    verify(ChurnA, ChurnB);

    return {
        name: "churn-a-b-a",
        operations: config.churnEntityCount,
        run() {
            migrate(ChurnA, ChurnB);
            migrate(ChurnB, ChurnA);
        },
        dispose() { game.dispose(); },
    };
}

function start(builder) {
    const game = builder.build();
    game.init();
    game.start();
    return game;
}

export const benchmarkDirectory = fileURLToPath(new URL(".", import.meta.url));
