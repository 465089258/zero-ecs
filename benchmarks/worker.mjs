import { performance } from "node:perf_hooks";
import process from "node:process";
import { createInterface } from "node:readline";
import { createScenario, loadBenchmarkConfig } from "./scenarios.mjs";

const profileName = argument("--profile") ?? "core";
const scenarioName = argument("--scenario");
if (!scenarioName) throw new Error("worker requires --scenario");
const config = await loadBenchmarkConfig(profileName);
const scenario = createScenario(scenarioName, config);
process.stdout.write(`${JSON.stringify({ ready: true, operations: scenario.operations })}\n`);

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const command of lines) {
    if (command === "close") break;
    if (command === "warmup") {
        scenario.run();
        process.stdout.write("{\"warmup\":true}\n");
        continue;
    }
    if (command === "measure") {
        const before = performance.now();
        scenario.run();
        const nsPerOp = (performance.now() - before) * 1e6 / scenario.operations;
        process.stdout.write(`${JSON.stringify({ nsPerOp })}\n`);
        continue;
    }
    throw new Error(`Unknown worker command: ${command}`);
}
scenario.dispose();

function argument(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}
