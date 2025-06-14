import { defineConfig } from "tsup";

export default defineConfig({
  tsconfig: "tsconfig.json",
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  esbuildOptions(options, context) {
    options.assetNames = "[name]";
    options.publicPath = "../dist";
  },
});
