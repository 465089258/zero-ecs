#!/usr/bin/env node
/**
 * zero-ecs-lib 性能基线收集与比较脚本
 *
 * 用法：
 *   node perf.mjs collect                 # 收集 A/A 校准 + 单构建 baseline
 *   node perf.mjs collect --skip-build    # 跳过 build（假设已经有生产构建）
 *   node perf.mjs compare --base <dir> --cand <dir>   # A/B 配对比较
 *   node perf.mjs summary <dir>           # 查看基线摘要
 *
 * 文档依据：docs/230-规范-性能与分配.md
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import process from "node:process";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";

const ROOT = resolve(import.meta.dirname);
const BENCH_DIR = resolve(ROOT, "benchmarks");
const OUT_DIR = resolve(ROOT, "perf-baseline");

// ─── 元数据收集 ────────────────────────────────────────────────

function collectRuntimeInfo() {
    let gitCommit = "unknown";
    let gitBranch = "unknown";
    try {
        gitCommit = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
        gitBranch = execSync("git branch --show-current", { cwd: ROOT, encoding: "utf8" }).trim();
    } catch {}

    return {
        node: process.version,
        v8: process.versions.v8,
        platform: process.platform,
        arch: process.arch,
        cpu: getCpuInfo(),
        gitCommit,
        gitBranch,
        buildMode: "production",
        timestamp: new Date().toISOString(),
    };
}

function getCpuInfo() {
    if (process.platform === "win32") {
        try {
            return execSync(
                "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty Name",
                { shell: "powershell", encoding: "utf8" },
            ).trim();
        } catch {}
    } else if (process.platform === "darwin") {
        try {
            return execSync("sysctl -n machdep.cpu.brand_string", { encoding: "utf8" }).trim();
        } catch {}
    } else {
        try {
            const lines = readFileSync("/proc/cpuinfo", "utf8").split("\n");
            for (const line of lines) {
                if (line.startsWith("model name")) return line.split(":")[1].trim();
            }
        } catch {}
    }
    return "unknown";
}

// ─── 子进程控制 ────────────────────────────────────────────────

function runCommand(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            cwd: ROOT,
            stdio: opts.silent ? ["pipe", "pipe", "pipe"] : "inherit",
            shell: opts.shell ?? false,
        });
        let stdout = "";
        let stderr = "";
        if (opts.silent) {
            child.stdout.on("data", d => (stdout += d));
            child.stderr.on("data", d => (stderr += d));
        }
        child.on("error", reject);
        child.on("close", code => {
            if (code !== 0 && !opts.allowNonZero) {
                reject(new Error(`${cmd} ${args.join(" ")} exited ${code}\n${stderr}`));
            } else {
                resolve({ code, stdout, stderr });
            }
        });
    });
}

async function ensureBuild() {
    console.log("[perf] 执行 npm run build ...");
    await runCommand("npm", ["run", "build"]);
    console.log("[perf] 构建完成");
}

// ─── 基线收集 ────────────────────────────────────────────────────

async function cmdCollect(args) {
    const skipBuild = args.includes("--skip-build");
    const runtime = collectRuntimeInfo();
    const stamp = runtime.timestamp.replace(/[:.]/g, "-").slice(0, 19);
    const outDir = resolve(OUT_DIR, `${stamp}-${runtime.gitCommit.slice(0, 8)}`);
    mkdirSync(outDir, { recursive: true });

    if (!skipBuild) await ensureBuild();

    console.log(`\n[perf] 收集 A/A 校准（core profile, 5 pairs × 50 rounds）...`);
    const aaResult = await runCompare(ROOT, ROOT, "core", null);
    writeFileSync(resolve(outDir, "a-a-calibration.json"), JSON.stringify(aaResult, null, 2));
    console.log("[perf] A/A 校准完成");

    console.log(`\n[perf] 收集单构建 baseline（core profile）...`);
    const singleResult = await runSingle("core", null);
    writeFileSync(resolve(outDir, "single-baseline.json"), JSON.stringify(singleResult, null, 2));
    console.log("[perf] 单构建 baseline 完成");

    const summary = buildBaselineSummary(runtime, aaResult, singleResult);
    writeFileSync(resolve(outDir, "summary.json"), JSON.stringify(summary, null, 2));

    // 输出到 stdout
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 基线收集完成 → ${outDir}`);
    console.log(`${"=".repeat(70)}`);
    printSummary(summary);

    // 同时更新 perf-baseline/current.json 作为最新基线索引
    const current = { runtime, outDir, summary, collectedAt: runtime.timestamp };
    writeFileSync(resolve(OUT_DIR, "current.json"), JSON.stringify(current, null, 2));
}

function buildBaselineSummary(runtime, aaResult, singleResult) {
    const noiseBands = {};
    for (const r of aaResult.results) {
        noiseBands[r.name] = {
            median: r.pairedRatioMedian,
            p95: r.pairedRatioP95,
            band: Math.max(0.01, r.pairedRatioP95),
            pairs: r.pairs.length,
        };
    }

    const absoluteValues = {};
    for (const r of singleResult.results) {
        absoluteValues[r.name] = {
            median: r.median,
            p95: r.p95,
            unit: r.unit,
        };
    }

    return { runtime, noiseBands, absoluteValues };
}

async function runCompare(baselineRoot, candidateRoot, profile, scenario) {
    const args = [
        "benchmarks/compare.mjs",
        "--baseline-root", baselineRoot,
        "--candidate-root", candidateRoot,
        "--profile", profile,
    ];
    if (scenario) args.push("--scenario", scenario);
    const { stdout } = await runCommand("node", args, { silent: true });
    return JSON.parse(stdout);
}

async function runSingle(profile, scenario) {
    const args = ["benchmarks/node.mjs", "--profile", profile];
    if (scenario) args.push("--scenario", scenario);
    const { stdout } = await runCommand("node", args, { silent: true });
    return JSON.parse(stdout);
}

// ─── 基线比较 ────────────────────────────────────────────────────

async function cmdCompare(args) {
    const baseIdx = args.indexOf("--base");
    const candIdx = args.indexOf("--cand");
    if (baseIdx === -1 || candIdx === -1) {
        console.error("用法: node perf.mjs compare --base <baseline-dir> --cand <candidate-dir>");
        process.exit(1);
    }
    const baseDir = resolve(OUT_DIR, args[baseIdx + 1]);
    const candDir = resolve(OUT_DIR, args[candIdx + 1]);

    if (!existsSync(resolve(baseDir, "summary.json"))) {
        console.error(`基线目录缺少 summary.json: ${baseDir}`);
        process.exit(1);
    }
    if (!existsSync(resolve(candDir, "summary.json"))) {
        console.error(`候选目录缺少 summary.json: ${candDir}`);
        process.exit(1);
    }

    const baseSummary = JSON.parse(readFileSync(resolve(baseDir, "summary.json"), "utf8"));
    const candSummary = JSON.parse(readFileSync(resolve(candDir, "summary.json"), "utf8"));

    // 从两个目录跑 A/B compare（生产构建必须已经完成）
    console.log(`\n[perf] 执行 A/B 配对比较...`);
    console.log(`  baseline : ${baseDir}`);
    console.log(`  candidate: ${candDir}`);
    const abResult = await runCompare(baseDir, candDir, "core", null);

    printComparison(baseSummary, candSummary, abResult);
}

function printSummary(summary) {
    const { runtime, noiseBands, absoluteValues } = summary;
    console.log(`\n── 运行环境 ──`);
    console.log(`  Node ${runtime.node}  V8 ${runtime.v8}`);
    console.log(`  ${runtime.platform} ${runtime.arch}  ${runtime.cpu}`);
    console.log(`  git ${runtime.gitCommit.slice(0, 8)}  ${runtime.gitBranch}`);
    console.log(`  ${runtime.timestamp}`);

    console.log(`\n── 各场景噪声带（A/A, band = max(1%, p95)）──`);
    console.log(`  ${"场景".padEnd(30)} ${"median".padStart(8)} ${"p95".padStart(8)} ${"band".padStart(8)}`);
    console.log(`  ${"-".repeat(54)}`);
    for (const [name, data] of Object.entries(noiseBands)) {
        console.log(`  ${name.padEnd(30)} ${(data.median * 100).toFixed(2).padStart(7)}% ${(data.p95 * 100).toFixed(2).padStart(7)}% ${(data.band * 100).toFixed(2).padStart(7)}%`);
    }

    console.log(`\n── 单构建绝对数值（core profile, ns/op）──`);
    console.log(`  ${"场景".padEnd(30)} ${"median".padStart(10)} ${"p95".padStart(10)}  unit`);
    console.log(`  ${"-".repeat(66)}`);
    for (const [name, data] of Object.entries(absoluteValues)) {
        console.log(`  ${name.padEnd(30)} ${data.median.toFixed(2).padStart(10)} ${data.p95.toFixed(2).padStart(10)}  ${data.unit}`);
    }
}

function printComparison(baseSummary, candSummary, abResult) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`📊 A/B 比较结果`);
    console.log(`${"=".repeat(70)}`);
    console.log(`  baseline  : ${baseSummary.runtime.gitCommit.slice(0, 8)}  ${baseSummary.runtime.timestamp}`);
    console.log(`  candidate : ${candSummary.runtime.gitCommit.slice(0, 8)}  ${candSummary.runtime.timestamp}`);
    console.log(`  mode      : ${abResult.mode}`);
    console.log(`  pairs     : ${abResult.config.runtimePairs}`);
    console.log(`  rounds    : ${abResult.config.measurementRounds}`);

    console.log(`\n  ${"场景".padEnd(30)} ${"cand/base".padStart(10)} ${"p95".padStart(8)} ${"噪声带".padStart(8)}  verdict`);
    console.log(`  ${"-".repeat(70)}`);

    let passed = 0, regressed = 0, withinNoise = 0;
    for (const r of abResult.results) {
        const band = baseSummary.noiseBands[r.name]?.band ?? 0.05;
        const median = r.pairedRatioMedian;
        const p95 = r.pairedRatioP95;

        let verdict, symbol;
        if (median > band) { verdict = "❌ 回退"; symbol = "FAIL"; regressed++; }
        else if (median < -band) { verdict = "✅ 改善"; symbol = "OK"; passed++; }
        else { verdict = "➖ 噪声内"; symbol = "~"; withinNoise++; }

        console.log(`  ${r.name.padEnd(30)} ${(median * 100).toFixed(2).padStart(8)}% ${(p95 * 100).toFixed(2).padStart(6)}% ${(band * 100).toFixed(2).padStart(6)}%  ${symbol} ${verdict}`);
    }

    console.log(`\n  通过: ${passed}  噪声内: ${withinNoise}  回退: ${regressed}`);
    if (regressed > 0) {
        console.log(`  ⚠️  存在超出噪声带的回退，需调查！`);
        process.exitCode = 1;
    } else {
        console.log(`  ✅ 无显著回退，全部通过噪声带。`);
    }
}

// ─── 基线摘要查看 ────────────────────────────────────────────────

function cmdSummary(args) {
    let dir = args[0];
    if (!dir) {
        const currentPath = resolve(OUT_DIR, "current.json");
        if (!existsSync(currentPath)) {
            console.error("没有找到 current.json，请先运行 'node perf.mjs collect'");
            process.exit(1);
        }
        const current = JSON.parse(readFileSync(currentPath, "utf8"));
        dir = current.outDir;
        console.log(`[perf] 使用最新基线: ${dir}`);
    } else {
        dir = resolve(OUT_DIR, dir);
    }

    const summaryPath = resolve(dir, "summary.json");
    if (!existsSync(summaryPath)) {
        // 尝试找目录
        if (!existsSync(dir)) {
            const matches = readdirSync(OUT_DIR).filter(n => n.includes(dir) || n.startsWith(dir));
            if (matches.length === 0) {
                console.error(`找不到基线目录: ${dir}`);
                listAvailable();
                process.exit(1);
            }
            dir = resolve(OUT_DIR, matches[0]);
        }
    }

    const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
    printSummary(summary);
}

function listAvailable() {
    if (!existsSync(OUT_DIR)) {
        console.log("没有 perf-baseline 目录");
        return;
    }
    console.log(`\n可用基线目录:`);
    for (const entry of readdirSync(OUT_DIR)) {
        const full = resolve(OUT_DIR, entry);
        if (existsSync(resolve(full, "summary.json"))) {
            console.log(`  ${entry}`);
        }
    }
}

// ─── 入口 ────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (cmd === "collect") await cmdCollect(args.slice(1));
    else if (cmd === "compare") await cmdCompare(args.slice(1));
    else if (cmd === "summary" || cmd === "show") cmdSummary(args.slice(1));
    else if (cmd === "list") listAvailable();
    else {
        console.log(`
zero-ecs-lib 性能基线工具
==========================

  collect                收集 A/A 校准 + 单构建 baseline（自动 build）
  collect --skip-build   跳过 build
  compare --base <tag> --cand <tag>   A/B 配对比较
  summary [tag]          查看基线摘要（默认最新）
  list                   列出所有可用基线

基线保存在: ${OUT_DIR}
当前机器: ${collectRuntimeInfo().cpu}
`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
