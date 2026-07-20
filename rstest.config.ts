import { resolve } from "node:path";
import { withRslibConfig } from "@rstest/adapter-rslib";
import { defineConfig } from "@rstest/core";

export default defineConfig({
  extends: withRslibConfig(),
  resolve: {
    alias: {
      "@zero-ecs/world/game-bridge": resolve("packages/world/src/game-bridge.ts"),
      "@zero-ecs/world/advanced": resolve("packages/world/src/advanced.ts"),
      "@zero-ecs/world": resolve("packages/world/src/index.ts"),
      "@zero-ecs/scheduler": resolve("packages/scheduler/src/index.ts"),
      "@zero-ecs/game/advanced": resolve("packages/game/src/advanced.ts"),
      "@zero-ecs/game/event": resolve("packages/game/src/event.ts"),
      "@zero-ecs/game/time": resolve("packages/game/src/time.ts"),
      "@zero-ecs/game/timer": resolve("packages/game/src/timer.ts"),
      "@zero-ecs/game/random": resolve("packages/game/src/random.ts"),
      "@zero-ecs/game/pool": resolve("packages/game/src/pool.ts"),
      "@zero-ecs/game": resolve("packages/game/src/index.ts"),
    },
  },
});
