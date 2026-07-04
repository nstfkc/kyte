import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve @kyte/core to its source (the "development" export), like dev mode.
  resolve: { conditions: ["development"] },
  test: {
    // A real DOM so we can render and interact with components.
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
