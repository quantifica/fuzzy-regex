#!/usr/bin/env bash
#
# Compiles vendor/tre plus bindings/tre_wasm.c to src/generated/tre.wasm.
#
# TRE's own build system is not used. Its configure script only exists to probe
# the host libc, and Emscripten's sysroot is a fixed target, so the probe results
# are checked in as bindings/wasm/config.h and bindings/wasm/tre-config.h. That
# keeps the autotools chain (autopoint/autoconf/automake/gettext/libtool) out of
# the build entirely.
#
# The output is a standalone reactor module: no Emscripten JS glue, no imports
# beyond a WASI stub the loader supplies. src/wasm.ts drives it directly.
#
# Requires the Emscripten SDK on PATH. Run from the repository root:
#   ./scripts/build-wasm.sh
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="src/generated"
OUT="$OUT_DIR/tre.wasm"

if ! command -v emcc >/dev/null 2>&1; then
  echo "error: emcc not found on PATH." >&2
  echo "Install the Emscripten SDK: https://emscripten.org/docs/getting_started/downloads.html" >&2
  echo "(macOS: brew install emscripten)" >&2
  exit 1
fi

echo "Building $OUT with $(emcc --version | head -1)"
mkdir -p "$OUT_DIR"

# TRE sources. tre-filter.c is excluded: it is not part of the library build
# upstream, and xmalloc.c is only needed for TRE's own debug allocator, which
# NDEBUG in config.h switches off.
TRE_SOURCES=(
  vendor/tre/lib/regcomp.c
  vendor/tre/lib/regerror.c
  vendor/tre/lib/regexec.c
  vendor/tre/lib/tre-ast.c
  vendor/tre/lib/tre-compile.c
  vendor/tre/lib/tre-match-approx.c
  vendor/tre/lib/tre-match-backtrack.c
  vendor/tre/lib/tre-match-parallel.c
  vendor/tre/lib/tre-mem.c
  vendor/tre/lib/tre-parse.c
  vendor/tre/lib/tre-stack.c
)

# Functions the loader calls. malloc/free are needed to stage the UTF-32 string
# and submatch buffers; the loader keeps those alive and reuses them rather than
# allocating per call.
EXPORTS='_fr_compile,_fr_free,_fr_last_error_code,_fr_last_error_message,_fr_nsub,_fr_exec,_malloc,_free'

emcc "${TRE_SOURCES[@]}" bindings/tre_wasm.c -o "$OUT" \
  -O3 \
  -flto \
  -DHAVE_CONFIG_H=1 \
  -I bindings/wasm \
  -I vendor/tre/lib \
  -I vendor/tre/local_includes \
  -Wno-unused-but-set-variable \
  -Wno-string-plus-int \
  --no-entry \
  -sSTANDALONE_WASM=1 \
  -sEXPORTED_FUNCTIONS="$EXPORTS" \
  -sALLOW_MEMORY_GROWTH=1 \
  -sINITIAL_MEMORY=4MB \
  -sMAXIMUM_MEMORY=512MB \
  -sSTACK_SIZE=1MB \
  -sSTACK_OVERFLOW_CHECK=1 \
  -sERROR_ON_UNDEFINED_SYMBOLS=1 \
  -sFILESYSTEM=0 \
  -sDISABLE_EXCEPTION_CATCHING=1

# -I bindings/wasm precedes the vendor include dirs so our checked-in
# config.h / tre-config.h win over any left over from a native ./configure run.

echo "Built $OUT ($(wc -c <"$OUT" | tr -d ' ') bytes)"

# Embed the binary as base64 in a TypeScript module. This is the artifact that
# is committed and published: it removes any runtime file-or-network lookup for
# the .wasm, so the package works identically under Node, browsers, workers and
# every bundler with no loader configuration. The .wasm itself is a build
# intermediate and is not committed.
node -e '
  const fs = require("fs");
  const wasm = fs.readFileSync(process.argv[1]);
  const base64 = wasm.toString("base64");
  /* Chunked so the generated file has bounded line length. */
  const lines = (base64.match(/.{1,120}/g) ?? []).map((l) => `  "${l}" +`);
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ \+$/, "");
  fs.writeFileSync(
    process.argv[2],
    [
      "/*",
      " * GENERATED FILE - DO NOT EDIT.",
      " *",
      " * src/generated/tre.wasm, base64-encoded. Regenerate with:",
      " *   ./scripts/build-wasm.sh",
      " *",
      ` * Source:  vendor/tre (TRE ${process.argv[3]}) + bindings/tre_wasm.c`,
      ` * Built:   emcc ${process.argv[4]}`,
      ` * Size:    ${wasm.length} bytes raw, ${base64.length} bytes base64`,
      ` * SHA-256: ${require("crypto").createHash("sha256").update(wasm).digest("hex")}`,
      " */",
      "",
      "export const TRE_WASM_BASE64 =",
      ...lines,
      ";",
      "",
    ].join("\n")
  );
' "$OUT" "$OUT_DIR/tre-wasm.ts" \
  "$(sed -n 's/.*TRE_VERSION "\(.*\)".*/\1/p' bindings/wasm/tre-config.h | head -1)" \
  "$(emcc --version | sed -n '1s/.*replacement + linker emulating GNU ld) //p')"

echo "Wrote $OUT_DIR/tre-wasm.ts ($(wc -c <"$OUT_DIR/tre-wasm.ts" | tr -d ' ') bytes)"
echo
echo "Imports (must be satisfiable by the stub in src/wasm.ts):"
node -e '
  const bytes = require("fs").readFileSync(process.argv[1]);
  const imports = WebAssembly.Module.imports(new WebAssembly.Module(bytes));
  if (!imports.length) console.log("  (none)");
  for (const i of imports) console.log(`  ${i.module}.${i.name} (${i.kind})`);
' "$OUT"
