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
const math = await import("@zero-ecs/math");
const math2d = await import("@zero-ecs/math/2d");
const math3d = await import("@zero-ecs/math/3d");
const mathProjection = await import("@zero-ecs/math/projection");
const flyingSword = await import("@zero-ecs/flying-sword");
const flyingSwordIntegration = await import("@zero-ecs/flying-sword/integration");
const flyingSwordPresentation = await import("@zero-ecs/flying-sword/presentation");

assert.equal(typeof world.World, "function");
assert.equal("EntityRef" in world, false);
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
assert.equal("EntityRef" in game, false);
assert.equal(game.Stage, scheduler.Stage);
assert.equal(typeof game.Game, "function");
assert.equal(typeof game.GameBuilder, "function");
assert.equal(typeof game.Commands, "function");
assert.equal("EntityCommand" in game, false);
assert.equal(typeof game.DefaultCoreModule, "function");
for (const optionalExport of [
    "EventArgs",
    "EventModule",
    "EventService",
    "FixedTimeResource",
    "TimeModule",
    "TimeState",
    "TimerConfigResource",
    "TimerModule",
    "TimerService",
    "RandomModule",
    "RandomService",
    "HierarchyModule",
    "HierarchyService",
    "ChildOf",
    "ParentOf",
    "ObjectPool",
    "ObjectPoolService",
    "definePool",
]) {
    assert.equal(optionalExport in game, false, `${optionalExport} leaked from @zero-ecs/game`);
}
assert.equal("CommandService" in game, false);
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
assert.equal(typeof math.Position2Type, "function");
assert.equal(typeof math.Position3Type, "function");
assert.equal(typeof math2d.Matrix3Type, "function");
assert.equal(typeof math3d.Matrix4Type, "function");
assert.equal(typeof mathProjection.OrthographicCameraType, "function");
assert.equal(typeof mathProjection.Projected2Type, "function");
assert.equal(typeof mathProjection.orthographicProjectionSystem, "function");
assert.equal(math2d.Float2.X, 0);
assert.equal(math3d.Float3.Z, 2);
assert.equal(typeof flyingSword.FlyingSwordModule, "function");
assert.equal(typeof flyingSword.FlyingSwordService, "function");
assert.equal(typeof flyingSword.FlyingSwordQuery, "object");
assert.equal("FlyingSwordStorage" in flyingSword, false);
assert.equal(typeof flyingSwordIntegration.FlyingSwordSpatialService, "function");
assert.equal(typeof flyingSwordPresentation.TopDownOrthographicCamera, "function");
assert.equal(typeof flyingSwordPresentation.DepthRenderQueue, "function");

assert.equal("Ecs" in game, false);
assert.equal("EcsBuilder" in game, false);
assert.equal("EcsPhase" in game, false);
assert.throws(() => new game.Game(), /Game must be created by GameBuilder/);
const compositionGame = new game.GameBuilder().build();
assert.equal("modules" in compositionGame, false);
compositionGame.dispose();

const allocator = new world.Allocator();
const standalone = new world.World(allocator);
assert.equal("createEntityCommand" in standalone, false);
assert.equal("applyEntityCommand" in standalone, false);
const entityId = standalone.spawn();
assert.equal("ref" in standalone, false);
assert.equal(standalone.valid(entityId), true);
standalone.dispose();
allocator.clear();

await assert.rejects(
    import("@zero-ecs/game/dist/runtime/game.js"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
await assert.rejects(
    import("@zero-ecs/world/game-bridge"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
await assert.rejects(
    import("@zero-ecs/game/dist/migration/migration-service.js"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
await assert.rejects(
    import("@zero-ecs/game/dist/command/control.js"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
await assert.rejects(
    import("@zero-ecs/flying-sword/dist/runtime/storage.js"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
await assert.rejects(
    import("@zero-ecs/math/dist/3d/components.js"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);

const worldSources = await sourceFiles("packages/world/src");
const schedulerSources = await sourceFiles("packages/scheduler/src");
const timerSources = await sourceFiles("packages/game/src/features/timer");
const gameSources = await sourceFiles("packages/game/src");
const mathSources = await sourceFiles("packages/math/src");
const flyingSwordSources = await sourceFiles("packages/flying-sword/src");
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
for (const file of gameSources) {
    const imports = importLines(await readFile(file, "utf8"));
    assert.doesNotMatch(imports, /@zero-ecs\/(?:math|flying-sword)/, file);
}
for (const file of mathSources) {
    const imports = importLines(await readFile(file, "utf8"));
    assert.doesNotMatch(imports, /@zero-ecs\/(?:world|scheduler|flying-sword)/, file);
}
for (const file of flyingSwordSources) {
    const imports = importLines(await readFile(file, "utf8"));
    assert.doesNotMatch(imports, /@zero-ecs\/(?:world|scheduler)/, file);
}

const gameManifest = JSON.parse(await readFile("packages/game/package.json", "utf8"));
assert.equal(gameManifest.peerDependencies["@zero-ecs/world"], "^0.1.0");
assert.equal(gameManifest.peerDependencies["@zero-ecs/scheduler"], "^0.1.0");
const flyingSwordManifest = JSON.parse(
    await readFile("packages/flying-sword/package.json", "utf8"),
);
const mathManifest = JSON.parse(await readFile("packages/math/package.json", "utf8"));
assert.equal(mathManifest.peerDependencies["@zero-ecs/game"], "^0.1.0");
assert.equal(flyingSwordManifest.peerDependencies["@zero-ecs/game"], "^0.1.0");

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
