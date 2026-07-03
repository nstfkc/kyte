import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  // core's entry has no exports, so api-extractor's rollupTypes has nothing to
  // bundle and errors — emit per-file declarations instead.
  plugins: [dts({ include: ["src"] })],
  build: {
    sourcemap: true,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
  },
});
