import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // loader: {
  //   ".node": "file",
  // },
  esbuildOptions(options, context) {
    options.assetNames = "[name]";
  },
});
