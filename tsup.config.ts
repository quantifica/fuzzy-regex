import { defineConfig } from "tsup";

export default defineConfig({
  tsconfig: "tsconfig.json",
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  /* The wasm binary is inlined as base64 in src/generated/tre-wasm.ts, so the
     bundle is self-contained: no .wasm asset to copy or resolve at runtime. */
});
