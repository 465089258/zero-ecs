import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "@rstest/core";

const FEATURE_ROOTS = ["attribute", "damage", "projectile", "shooter", "zombie"] as const;
const MODULES_ROOT = join(process.cwd(), "examples", "shooter-zombie", "src", "modules");

describe("shooter-zombie module boundaries", () => {
    test.each(FEATURE_ROOTS)("%s does not depend on the integration layer", feature => {
        for (const file of sourceFiles(join(MODULES_ROOT, feature))) {
            expect(readFileSync(file, "utf8"), file).not.toMatch(/from\s+["'][^"']*integration\//);
        }
    });

    test("damage core does not depend on attributes or concrete producers", () => {
        const source = combinedSources(join(MODULES_ROOT, "damage"));
        expect(source).not.toMatch(/from\s+["'][^"']*(?:attribute|projectile|shooter|zombie)\//);
    });

    test("attribute core does not depend on gameplay feature modules", () => {
        const source = combinedSources(join(MODULES_ROOT, "attribute"));
        expect(source).not.toMatch(/from\s+["'][^"']*(?:damage|projectile|shooter|zombie)\//);
    });
});

function combinedSources(directory: string): string {
    return sourceFiles(directory).map(file => readFileSync(file, "utf8")).join("\n");
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
