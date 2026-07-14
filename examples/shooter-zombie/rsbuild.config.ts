import { defineConfig } from "@rsbuild/core";

export default defineConfig({
    source: {
        entry: {
            index: "./examples/shooter-zombie/src/main.ts",
        },
    },
    html: {
        template: "./examples/shooter-zombie/index.html",
    },
    output: {
        distPath: {
            root: "dist-example/shooter-zombie",
        },
        cleanDistPath: true,
    },
    server: {
        port: 3101,
    },
});
