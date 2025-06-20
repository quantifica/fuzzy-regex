import { defineConfig } from "tsup";

export default defineConfig({
  shims: true,
  tsconfig: "tsconfig.json",
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  esbuildOptions(options) {
    options.assetNames = "[name]";
  },
});
