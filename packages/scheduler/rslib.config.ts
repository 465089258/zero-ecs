import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [{
    syntax: "es2015",
    bundle: false,
    dts: true,
    source: { entry: { index: ["./src/**"] } },
  }],
});
