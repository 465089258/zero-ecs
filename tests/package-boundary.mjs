import assert from "node:assert/strict";

const root = await import("zero-ecs-lib");
const advanced = await import("zero-ecs-lib/advanced");

assert.equal("Scheduler" in root, false);
assert.equal("EntityCommand" in root, false);
assert.equal("DataSet" in root, false);
assert.equal("Mask" in root, false);
assert.equal("InternalPost" in root, false);
assert.equal("EntityMigrationService" in root, false);

assert.equal(typeof advanced.Scheduler, "function");
assert.equal(typeof advanced.EntityCommand, "function");
assert.equal(typeof advanced.DataSet, "function");
assert.equal(typeof advanced.Mask, "function");
assert.equal("InternalPost" in advanced, false);
assert.equal("EntityMigrationService" in advanced, false);

assert.throws(() => new root.Ecs(), /Ecs must be created by EcsBuilder/);

await assert.rejects(
    import("zero-ecs-lib/dist/schedule/internal-stage.js"),
    error => error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
);
