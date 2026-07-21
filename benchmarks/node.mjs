import { performance } from "node:perf_hooks";
import process from "node:process";
import {
    benchmarkChecksum,
    createScenario,
    loadBenchmarkConfig,
    scenarioNames,
} from "./scenarios.mjs";

const profileName = argument("--profile") ?? "smoke";
const selected = argument("--scenario");
const config = await loadBenchmarkConfig(profileName);
const names = selected ? [selected] : scenarioNames;
const results = [];

for (const name of names) {
    const scenario = createScenario(name, config);
    try {
        for (let i = 0; i < config.warmupRounds; i++) scenario.run();
        const rounds = new Float64Array(config.measurementRounds);
        for (let i = 0; i < rounds.length; i++) {
            const before = performance.now();
            scenario.run();
            rounds[i] = (performance.now() - before) * 1e6 / scenario.operations;
        }
        const sorted = Float64Array.from(rounds).sort();
        results.push({
            name,
            operationsPerRound: scenario.operations,
            unit: "ns/op",
            median: quantile(sorted, 0.5),
            p95: quantile(sorted, 0.95),
            rounds: Array.from(rounds),
        });
    } finally {
        scenario.dispose();
    }
}

const output = {
    schemaVersion: config.schemaVersion,
    mode: "single-build-smoke",
    approvalEligible: false,
    profile: profileName,
    runtime: {
        node: process.version,
        v8: process.versions.v8,
        platform: process.platform,
        arch: process.arch,
    },
    config,
    checksum: benchmarkChecksum(),
    results,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

function quantile(sorted, q) {
    if (sorted.length === 0) return Number.NaN;
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)];
}

function argument(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}
