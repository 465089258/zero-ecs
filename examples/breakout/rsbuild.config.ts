import { defineConfig } from "@rsbuild/core";

export default defineConfig({
    source: {
        entry: {
            index: "./examples/breakout/src/main.ts",
        },
    },
    html: {
        template: "./examples/breakout/index.html",
    },
    output: {
        distPath: {
            root: "dist-example/breakout",
        },
        cleanDistPath: true,
    },
    server: {
        port: 3100,
    },
});
