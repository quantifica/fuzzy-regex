# fuzzy-regex

A regular expression library that allows for a configurable number of mismatches (fuzzy matching), powered by the high-performance [TRE](https://laurikari.net/tre/) regex engine compiled to WebAssembly. This package supports both ESM and CommonJS, and provides a simple API for fuzzy string matching with regular expressions.

## Features

- Fuzzy matching with configurable error tolerance
- Case-insensitive or case-sensitive matching
- Drop-in replacement for many RegExp use cases
- Initialize with JS RegExp, allowing easy transition and familiar syntax
- Runs anywhere WebAssembly does: Node, browsers, web workers, Deno, Bun, edge runtimes
- Async API everywhere, plus a synchronous one for Node
- No native build step, no compiler, and zero runtime dependencies
- Unicode-aware: errors and offsets are counted in code points, not bytes

## Installation

```sh
npm install fuzzy-regex
```

The TRE engine ships prebuilt as a ~64 KB WebAssembly module embedded in the bundle, so there is nothing to compile on install and no `.wasm` file to serve, copy, or configure a bundler for.

## Usage

```js
import { fuzzyRegex } from "fuzzy-regex";
// or: const { fuzzyRegex } = require('fuzzy-regex');

// Create a fuzzy regex (case-insensitive by default)
const regex = await fuzzyRegex("fooooo");

console.log(regex.test("mooooo")); // true (1 substitution allowed)
console.log(regex.test("moooow")); // false

// Override case sensitivity
const csRegex = await fuzzyRegex("Foo", { caseInsensitive: false });
console.log(csRegex.test("foo")); // false

// Control the maximum number of errors
const regexWithErrors = await fuzzyRegex("foo", { maxErr: 2, maxCost: 2, maxSubst: 2 });
console.log(regexWithErrors.test("foa")); // true (1 substitution)
console.log(regexWithErrors.test("faa")); // true (2 substitutions)
console.log(regexWithErrors.test("aaa")); // false (3 substitutions, over the budget)

// Use .exec to extract groups
const pageRegex = await fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)");
const result = pageRegex.exec("page I of 6");
console.log(result[0]); // 'page I of 6'
console.log(result[1]); // 'I'
console.log(result[2]); // '6'

// Initialize with JS RegExp
const jsRegex = await fuzzyRegex(/page\s+(\d+)\s+of\s+(\d+)/); // will be case-sensitive without `i` flag
const jsResult = jsRegex.exec("page I of 6");
console.log(jsResult[1]); // 'I'
console.log(jsResult[2]); // '6'

// Case sensitive param mismatch
const mismatchRegex = await fuzzyRegex(/Foo/i, { caseInsensitive: false }); // this will reject
```

`fuzzyRegex` is async because it instantiates the WebAssembly module on first use, which cannot be done synchronously on a browser main thread. Only the first call pays that cost; every later call resolves from the cached module. Matching itself (`test`, `exec`) is synchronous.

To move the one-time instantiation somewhere convenient, such as app startup, call `init` up front:

```js
import { fuzzyRegex, init } from "fuzzy-regex";

await init(); // optional; pre-warms the wasm module
```

### Synchronous API (Node)

On Node, where WebAssembly can be instantiated synchronously, `fuzzyRegexSync` skips the promise entirely:

```js
import { fuzzyRegexSync } from "fuzzy-regex";

const regex = fuzzyRegexSync("fooooo");
console.log(regex.test("mooooo")); // true
```

It takes the same arguments as `fuzzyRegex`, returns the same object, and shares the same underlying WebAssembly module — mixing the two in one program instantiates once, in either order. Errors that `fuzzyRegex` rejects with, `fuzzyRegexSync` throws.

This is the one part of the API that is not portable. A browser main thread refuses to compile a module this size synchronously, so calling it there throws and tells you to use `fuzzyRegex` instead. Use it in Node scripts, CLIs, and servers; use `fuzzyRegex` in anything that also has to run in a browser.

## API

### `fuzzyRegex(pattern: string | RegExp, options?: Options): Promise<FuzzyRegex>`

- `pattern`: The regex pattern (string or RegExp). POSIX extended syntax; for a `RegExp`, only `source` and the `i` flag are used.
- `options`: Discussed below
- Returns: `Promise<{ test(str), exec(str), toString(), free() }>`
- Rejects with a `SyntaxError` if `pattern` is not a valid POSIX extended regular expression.

- `test(str)`: Returns `true` if `str` matches `pattern` within the allowed number of errors (configured via options)
- `exec(str)`: Returns an array of the whole match followed by each capture group, or `null` if there is no match within the allowed number of errors. A group that did not participate in the match is `undefined`, as with `RegExp` — see [Optional groups](#optional-groups).
- `toString()`: Returns the pattern source
- `free()`: Releases the compiled pattern's WebAssembly memory. Optional — see [Memory](#memory).

For both matching methods, the default number of errors defaults to 1 per 10 characters (rounded) of the smaller of the pattern and test string.

Example: `"lorem ipsum"` is 11 characters and the subject below is longer, so the budget is 1 error:

```js
const regex = await fuzzyRegex("lorem ipsum");
regex.test("Lo4em ipsum dolor sit amet"); // true  - 1 substitution
regex.test("Lo4em 1psum dolor sit amet"); // false - 2 substitutions, over the budget
```

### `fuzzyRegexSync(pattern: string | RegExp, options?: Options): FuzzyRegex`

**Node only.** Identical to `fuzzyRegex` but returns the `FuzzyRegex` directly instead of a promise, and throws where `fuzzyRegex` rejects. Throws if the runtime refuses synchronous WebAssembly compilation, which a browser main thread does for a module this size.

### `init(options?: InitOptions): Promise<TreModule>`

Instantiates the WebAssembly module. Optional: `fuzzyRegex` calls it for you. Use it to pre-warm, or to supply your own binary via `init({ module })`, which accepts an already-compiled `WebAssembly.Module` (useful for sharing one compilation across workers) or raw bytes. The result is cached, so repeated calls return the same module and ignore later options.

### `initSync(options?: InitOptions): TreModule`

**Node only.** Synchronous `init`, with the same caching. `init` and `initSync` share one module in either order, so a program that mixes the sync and async entry points still instantiates only once.

## Options

- `caseInsensitive`: Whether to do case insensitive matching. Default: `true`
- `costIns`: The cost to insert one character where the regex was not expecting. Default: `1`
- `costDel`: The cost to delete a character the regex was expecting. Default: `1`
- `costSubst`: The cost the substitute an expected character for an unexpected character. Default: `1`
- `maxCost`: The max cost allowed. Default: Based on string and regex length
- `maxIns`: The maximum insertions allowed. Default: Based on string and regex length
- `maxDel`: The maximum deletions allowed. Default: Based on string and regex length
- `maxSubst`: The maximum substitutions allowed. Default: Based on string and regex length
- `maxErr`: The maximum errors allowed. Same as max cost if costs are 1. Default: Based on string and regex length

## Optional groups

`exec` is typed `string[] | null`, but a group that did not participate in the match is `undefined` at runtime:

```js
const regex = await fuzzyRegex("a(x)?b", { maxErr: 0, maxCost: 0 });
regex.exec("ab"); // ["ab", undefined]
```

This is exactly what `RegExp` does, and the type is deliberately declared the same way `RegExp` is — TypeScript declares `RegExpExecArray extends Array<string>` despite the same runtime `undefined`. Matching that keeps `FuzzyRegex` assignable to the RegExp-shaped matcher interfaces this library is meant to drop into, instead of forcing a cast at every boundary.

If your pattern has optional or alternated groups, guard before using them:

```ts
const groups = regex.exec(input);
const maybe = groups?.[1] as string | undefined;
if (maybe !== undefined) {
  // ...
}
```

Patterns whose groups always participate can index directly. If you would rather have the compiler enforce this, narrow it at your own boundary:

```ts
const exec = (str: string) =>
  regex.exec(str) as (string | undefined)[] | null;
```

## Memory

A compiled pattern lives in the WebAssembly heap. Dropping a `FuzzyRegex` releases it automatically once the garbage collector runs, via `FinalizationRegistry`, so most code never needs to think about this.

Finalizers are not guaranteed to run promptly, so if you compile many short-lived patterns, release them eagerly:

```js
const regex = await fuzzyRegex(pattern);
try {
  return regex.test(input);
} finally {
  regex.free();
}
```

`Symbol.dispose` is also set, so on runtimes with explicit resource management you can write `using regex = await fuzzyRegex(pattern);` instead. Using a regex after `free()` throws; calling `free()` more than once is a no-op.

Reuse a compiled pattern across many inputs where you can — compiling is the expensive part, and `test`/`exec` allocate nothing per call.

## Unicode

Strings are matched as sequences of Unicode code points, so one accented or non-Latin character counts as one error rather than one per UTF-8 byte, and offsets in `exec` results line up with JavaScript string indices:

```js
const regex = await fuzzyRegex("café", { maxErr: 1, maxCost: 1, maxSubst: 1 });
console.log(regex.test("cafe")); // true — a single substitution

const emoji = await fuzzyRegex("👍 (\\w+)");
console.log(emoji.exec("👍 yes")[1]); // 'yes'
```

Case-insensitive matching also covers non-ASCII letters, so `ÉCOLE` matches `école`.

## Performance

Matching runs about 1.3–1.8× slower than the equivalent native build, which is the usual cost of WebAssembly versus compiled machine code. In exchange the package needs no compiler at install time and runs on platforms a native addon cannot reach at all. Reusing compiled patterns matters far more than the engine backend; compiling is roughly as expensive as thousands of matches.

## Migrating from v2

v2 was a Node-only native addon built with `node-gyp`. v3 is WebAssembly and the API is async:

```diff
- const regex = fuzzyRegex("fooooo");
+ const regex = await fuzzyRegex("fooooo");
```

If your code is Node-only and you would rather not thread `await` through it, `fuzzyRegexSync` keeps the v2 call shape:

```diff
- const regex = fuzzyRegex("fooooo");
+ const regex = fuzzyRegexSync("fooooo");
```

Everything else behaves the same, with these differences:

- **`exec` returns `undefined` for a group that did not participate** in the match, matching `RegExp`. v2 could throw in that case. See [Optional groups](#optional-groups).
- **An invalid pattern rejects with a `SyntaxError`** carrying TRE's message. v2 threw a generic `Error` with a numeric code.
- **Errors and offsets are counted in code points, not UTF-8 bytes.** A pattern or subject containing non-ASCII characters may now match where it did not before, because one such character costs one error instead of two or three.
- **No build toolchain is required.** The `autopoint autoconf automake gettext libtool` / C++ compiler / Python prerequisites are gone, as is the `os` restriction to Linux and macOS. There are no runtime dependencies.
- **`free()` is available** to release a compiled pattern eagerly. Not required; see [Memory](#memory).

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub. To develop locally:

```sh
git clone <repo-url>
npm install
npm test
```

Tests are written with Jest (`npm test`) and run against the committed WebAssembly artifact, so the common case needs no C toolchain.

### Rebuilding the WebAssembly module

Only needed if you change `bindings/tre_wasm.c`, `bindings/wasm/*.h`, or `vendor/tre`. Requires the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) (`brew install emscripten` on macOS):

```sh
npm run build:wasm   # regenerates src/generated/tre-wasm.ts
npm test
```

`src/generated/tre-wasm.ts` embeds the compiled module as base64 and is committed, which is why publishing needs no Emscripten. Commit it alongside your source change; CI rebuilds it and runs the suite against the result to catch a stale artifact.

TRE's own autotools build is not used. Its `configure` script exists only to probe the host libc, and Emscripten's sysroot is a fixed target, so those results are checked in as `bindings/wasm/config.h` and `bindings/wasm/tre-config.h`.

## License

MIT License. See [LICENSE](./LICENSE) for details.

## Acknowledgments

- [TRE](https://laurikari.net/tre/) - The underlying approximate regex engine
- [Emscripten](https://emscripten.org/) - The toolchain that compiles TRE to WebAssembly
- Inspired by the need for fast, flexible fuzzy matching in Node.js
