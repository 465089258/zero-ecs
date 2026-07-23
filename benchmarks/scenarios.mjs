import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
    Command,
    CommandModule,
    Commands,
    defSystem,
    EventArgs,
    EventModule,
    EventService,
    FixedTimeResource,
    GameBuilder,
    TimeModule,
    TimerModule,
    TimerService,
    Types,
    Update,
} from "@zero-ecs/game";
import { Allocator, World } from "@zero-ecs/world";

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
    "world-valid",
    "world-get",
    "world-has",
    "commands",
    "events",
    "timers",
    "churn-a-b-a",
]);

export function createScenario(name, config) {
    if (name.startsWith("scheduler-")) {
        return createSchedulerScenario(Number(name.slice("scheduler-".length)), config);
    }
    if (name.startsWith("world-")) return createWorldReadScenario(name, config);
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

function createWorldReadScenario(name, config) {
    const allocator = new Allocator();
    const world = new World(allocator);
    const entities = new Uint32Array(config.readEntityCount);
    for (let i = 0; i < entities.length; i++) {
        const entity = world.spawn();
        entities[i] = entity;
        const command = world.createEntityCommand(entity).add(BenchPosition).set(BenchPosition, 0, i);
        if (!world.applyEntityCommand(command)) throw new Error("World read setup failed");
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

function createCommandScenario(config) {
    const game = start(new GameBuilder().addModule(new CommandModule()));
    const commands = game.service(Commands);
    return {
        name: "commands",
        operations: config.queuedOperations,
        run() {
            for (let i = 0; i < config.queuedOperations; i++) commands.cmd(BenchCommand).submit();
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
