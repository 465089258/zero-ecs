import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve, sep } from "node:path";
import { describe, expect, test } from "@rstest/core";

const LEAF_MODULES = [
    "attribute",
    "damage",
    "feedback",
    "projectile",
    "progression",
    "shooter",
    "zombie",
] as const;
const MODULES_ROOT = resolve("examples", "shooter-zombie", "src", "modules");

describe("shooter-zombie module boundaries", () => {
    test.each(LEAF_MODULES)("%s is an independent leaf module", moduleName => {
        expectInternalImports(moduleName, new Set([moduleName, "common"]));
    });

    test("shared kernel does not depend on outer modules", () => {
        expectInternalImports("common", new Set(["common"]));
    });

    test("host adapter does not depend on gameplay modules", () => {
        expectInternalImports("host", new Set(["host"]));
    });

    test("integration composes inward modules but never presentation", () => {
        const allowed = new Set<string>(["integration", "common", "host", ...LEAF_MODULES]);
        expectInternalImports("integration", allowed);
    });

    test("only the composition root and presentation may depend on presentation", () => {
        for (const moduleName of ["common", "host", "integration", ...LEAF_MODULES]) {
            for (const file of sourceFiles(join(MODULES_ROOT, moduleName))) {
                expect(importedModules(file), file).not.toContain("presentation");
            }
        }
    });

    test("cross-module imports use the target module public entry", () => {
        for (const moduleName of ["common", "host", "integration", "presentation", ...LEAF_MODULES]) {
            for (const file of sourceFiles(join(MODULES_ROOT, moduleName))) {
                for (const edge of importedModuleEdges(file)) {
                    if (edge.moduleName === moduleName) continue;
                    expect(edge.target, file).toBe(join(MODULES_ROOT, edge.moduleName));
                }
            }
        }
    });

    test("feature render systems depend only on backend abstractions", () => {
        const slices = [
            "defense", "feedback", "ground", "progression", "projectile", "shooter", "zombie",
        ];
        for (const slice of slices) {
            const file = join(MODULES_ROOT, "presentation", slice, "systems.ts");
            const source = readFileSync(file, "utf8");
            expect(source, file).not.toMatch(/Canvas|WebGL|GameViewResource|RenderingContext/);
            expect(source, file).toContain("RenderService");
        }
    });

    test("obsolete cross-cutting lifecycle module stays removed", () => {
        const moduleNames = readdirSync(MODULES_ROOT);
        expect(moduleNames).not.toContain("lifecycle");
    });
});

function expectInternalImports(moduleName: string, allowed: ReadonlySet<string>): void {
    for (const file of sourceFiles(join(MODULES_ROOT, moduleName))) {
        for (const importedModule of importedModules(file)) {
            expect(allowed.has(importedModule), `${file} imports ${importedModule}`).toBe(true);
        }
    }
}

function importedModules(file: string): string[] {
    return importedModuleEdges(file).map(edge => edge.moduleName);
}

function importedModuleEdges(file: string): Array<{
    readonly moduleName: string;
    readonly specifier: string;
    readonly target: string;
}> {
    const source = readFileSync(file, "utf8");
    const result: Array<{ moduleName: string; specifier: string; target: string }> = [];
    const imports = /(?:from\s+|import\s*)["'](\.[^"']+)["']/g;
    for (const match of source.matchAll(imports)) {
        const specifier = match[1];
        const target = normalize(resolve(dirname(file), specifier));
        const path = relative(MODULES_ROOT, target);
        if (path.startsWith(`..${sep}`) || path === "..") continue;
        result.push({ moduleName: path.split(sep)[0], specifier, target });
    }
    return result;
}

function sourceFiles(directory: string): string[] {
    const result: string[] = [];
    for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) result.push(...sourceFiles(path));
        else if (path.endsWith(".ts")) result.push(path);
    }
    return result;
}
