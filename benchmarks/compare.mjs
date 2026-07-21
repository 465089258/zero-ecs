import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import process from "node:process";
import { createInterface } from "node:readline";
import { loadBenchmarkConfig, scenarioNames } from "./scenarios.mjs";

const baselineRoot = resolve(required("--baseline-root"));
const candidateRoot = resolve(required("--candidate-root"));
const profileName = argument("--profile") ?? "core";
const selected = argument("--scenario");
const config = await loadBenchmarkConfig(profileName);
const names = selected ? [selected] : scenarioNames;
const results = [];

for (const name of names) {
    const ratios = [];
    const pairResults = [];
    for (let pair = 0; pair < config.runtimePairs; pair++) {
        const baseline = await startWorker(baselineRoot, name);
        const candidate = await startWorker(candidateRoot, name);
        try {
            for (let i = 0; i < config.warmupRounds; i++) {
                await baseline.request("warmup");
                await candidate.request("warmup");
            }
            const baselineRounds = [];
            const candidateRounds = [];
            for (let round = 0; round < config.measurementRounds; round++) {
                const first = round % 2 === 0 ? baseline : candidate;
                const second = round % 2 === 0 ? candidate : baseline;
                const firstResult = await first.request("measure");
                const secondResult = await second.request("measure");
                const baselineValue = first === baseline ? firstResult.nsPerOp : secondResult.nsPerOp;
                const candidateValue = first === candidate ? firstResult.nsPerOp : secondResult.nsPerOp;
                baselineRounds.push(baselineValue);
                candidateRounds.push(candidateValue);
                ratios.push(candidateValue / baselineValue - 1);
            }
            pairResults.push({ pair, baselineRounds, candidateRounds });
        } finally {
            await baseline.close();
            await candidate.close();
        }
    }
    const sorted = [...ratios].sort((a, b) => a - b);
    results.push({
        name,
        pairedRatioMedian: quantile(sorted, 0.5),
        pairedRatioP95: quantile(sorted, 0.95),
        pairs: pairResults,
    });
}

process.stdout.write(`${JSON.stringify({
    schemaVersion: config.schemaVersion,
    mode: baselineRoot === candidateRoot ? "a-a-calibration" : "a-b-comparison",
    baselineRoot,
    candidateRoot,
    profile: profileName,
    config,
    results,
}, null, 2)}\n`);

async function startWorker(root, scenario) {
    const workerPath = resolve(root, "benchmarks/worker.mjs");
    const child = spawn(process.execPath, [workerPath, "--profile", profileName, "--scenario", scenario], {
        cwd: root,
        stdio: ["pipe", "pipe", "inherit"],
    });
    const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
    const iterator = lines[Symbol.asyncIterator]();
    const ready = JSON.parse((await iterator.next()).value);
    if (!ready.ready) throw new Error(`Worker failed to initialize: ${root}`);
    return {
        async request(command) {
            child.stdin.write(`${command}\n`);
            const result = await iterator.next();
            if (result.done) throw new Error(`Worker exited during ${command}: ${root}`);
            return JSON.parse(result.value);
        },
        async close() {
            if (child.exitCode === null) child.stdin.end("close\n");
            await once(child, "exit");
            lines.close();
            if (child.exitCode !== 0) throw new Error(`Worker exited with code ${child.exitCode}: ${root}`);
        },
    };
}

function quantile(sorted, q) {
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
}

function argument(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

function required(name) {
    const value = argument(name);
    if (!value) throw new Error(`Missing ${name}`);
    return value;
}
