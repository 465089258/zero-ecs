import { defineConfig } from "@rsbuild/core";

export default defineConfig({
    source: {
        entry: { index: "./examples/shooter-zombie/oop/src/main.ts" },
    },
    html: {
        template: "./examples/shooter-zombie/oop/index.html",
    },
    output: {
        distPath: { root: "dist-example/shooter-zombie-oop" },
    },
    server: {
        port: 3102,
    },
});
