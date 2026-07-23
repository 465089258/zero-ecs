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
        target: "web",
        minify: {
            js: true,
            jsOptions: {
                minimizerOptions: {
                    compress: {
                        inline: 0,
                        reduce_vars: false,
                    }
                }
            }
        }

    },
    server: {
        port: 3101,
    },
    tools: {
        swc: {
            jsc: {
                target: "es5",
                loose: true,
            }
        }
    }
});
