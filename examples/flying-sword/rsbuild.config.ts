import { defineConfig } from "@rsbuild/core";

export default defineConfig({
    source: {
        entry: {
            index: "./examples/flying-sword/src/main.ts",
        },
    },
    html: {
        template: "./examples/flying-sword/index.html",
    },
    output: {
        distPath: {
            root: "dist-example/flying-sword",
        },
        cleanDistPath: true,
        target: "web",
    },
    server: {
        port: 3102,
    },
});
