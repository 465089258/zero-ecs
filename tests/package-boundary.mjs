import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const world = await import("@zero-ecs/world");
const worldAdvanced = await import("@zero-ecs/world/advanced");
const scheduler = await import("@zero-ecs/scheduler");
const game = await import("@zero-ecs/game");
const gameAdvanced = await import("@zero-ecs/game/advanced");
const event = await import("@zero-ecs/game/event");
const time = await import("@zero-ecs/game/time");
const timer = await import("@zero-ecs/game/timer");
const random = await import("@zero-ecs/game/random");
const hierarchy = await import("@zero-ecs/game/hierarchy");
const pool = await import("@zero-ecs/game/pool");

assert.equal(typeof world.World, "function");
assert.equal(typeof world.EntityRef, "function");
assert.equal(typeof world.Allocator, "function");
assert.equal(typeof world.QueryType, "function");
assert.equal("Service" in world, false);
assert.equal("State" in world, false);
assert.equal("Scheduler" in world, false);
assert.equal("Stage" in world, false);
assert.equal("Commands" in world, false);
assert.equal(typeof worldAdvanced.DataSet, "function");
assert.equal(typeof worldAdvanced.Mask, "function");

assert.equal(typeof scheduler.Stage, "function");
assert.equal(typeof scheduler.SystemSet, "function");
assert.equal(typeof scheduler.ScheduleBuilder, "function");
assert.equal(typeof scheduler.Scheduler, "function");
assert.equal("World" in scheduler, false);
assert.equal("QueryType" in scheduler, false);
assert.equal("Service" in scheduler, false);
assert.equal("Update" in scheduler, false);

assert.equal(game.World, world.World);
assert.equal(game.EntityRef, world.EntityRef);
assert.equal(game.Stage, scheduler.Stage);
assert.equal(typeof game.Game, "function");
assert.equal(typeof game.GameBuilder, "function");
assert.equal(typeof game.Commands, "function");
assert.equal("EntityCommand" in game, false);
assert.equal(typeof game.DefaultCoreModule, "function");
assert.equal(game.CommandService, game.Commands);
assert.equal("Scheduler" in game, false);
assert.equal("DataSet" in game, false);
assert.equal("InternalPost" in game, false);
assert.equal("EntityMigrationService" in game, false);
assert.equal("CommandState" in game, false);
assert.equal("TimerPoolService" in game, false);
assert.equal(typeof gameAdvanced.Scheduler, "function");
assert.equal(typeof gameAdvanced.DataSet, "function");

assert.equal(typeof event.EventModule, "function");
assert.equal(typeof time.TimeModule, "function");
assert.equal(typeof timer.TimerModule, "function");
assert.equal(typeof timer.TimerConfigResource, "function");
assert.equal(typeof random.RandomModule, "function");
assert.equal(typeof hierarchy.HierarchyModule, "function");
assert.equal(typeof hierarchy.HierarchyService, "function");
assert.equal(typeof hierarchy.ChildOf, "object");
assert.equal(typeof hierarchy.ParentOf, "object");
assert.equal("ChildOfStorage" in hierarchy, false);
assert.equal("ParentOfStorage" in hierarchy, false);
assert.equal(typeof pool.ObjectPoolService, "function");

assert.equal(game.Ecs, game.Game);
assert.equal(game.EcsBuilder, game.GameBuilder);
assert.equal(game.EcsPhase, game.GamePhase);
assert.throws(() => new game.Game(), /Game must be created by GameBuilder/);

const allocator = new world.Allocator();
const standalone = new world.World(allocator);
const entityId = standalone.reserveEntity();
const entityRef = standalone.ref(entityId);
assert.equal(entityRef instanceof world.EntityRef, true);
assert.equal(standalone.valid(entityId), true);
assert.equal(entityRef.valid, true);
standalone.dispose();
assert.equal(entityRef.valid, false);
allocator.clear();

await assert.rejects(
    import("@zero-ecs/game/dist/runtime/game.js"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);

const worldSources = await sourceFiles("packages/world/src");
const schedulerSources = await sourceFiles("packages/scheduler/src");
const timerSources = await sourceFiles("packages/game/src/features/timer");
for (const file of worldSources) {
    const imports = importLines(await readFile(file, "utf8"));
    assert.doesNotMatch(imports, /@zero-ecs\/(?:game|scheduler)/, file);
}
for (const file of schedulerSources) {
    const imports = importLines(await readFile(file, "utf8"));
    assert.doesNotMatch(imports, /@zero-ecs\/(?:world|game)/, file);
    assert.doesNotMatch(imports, /(?:context|resource|state|service|query|world)/i, file);
}
for (const file of timerSources) {
    const imports = importLines(await readFile(file, "utf8"));
    assert.doesNotMatch(imports, /@zero-ecs\/world|command-service|\/command\//, file);
}

const gameManifest = JSON.parse(await readFile("packages/game/package.json", "utf8"));
assert.equal(gameManifest.peerDependencies["@zero-ecs/world"], "^0.1.0");
assert.equal(gameManifest.peerDependencies["@zero-ecs/scheduler"], "^0.1.0");

async function sourceFiles(directory) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) result.push(...await sourceFiles(path));
        else if (entry.name.endsWith(".ts")) result.push(path);
    }
    return result;
}

function importLines(source) {
    return [...source.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
        .map(match => match[1])
        .join("\n");
}
await assert.rejects(
    import("@zero-ecs/world/dist/command/entity-command.js"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
