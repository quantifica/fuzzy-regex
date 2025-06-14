# fuzzy-regex

A regular expression library for Node.js that allows for a configurable number of mismatches (fuzzy matching), powered by the high-performance [TRE](https://laurikari.net/tre/) regex engine. This package supports both ESM and CommonJS, and provides a simple API for fuzzy string matching with regular expressions.

## Features

- Fuzzy matching with configurable error tolerance
- Case-insensitive or case-sensitive matching
- Drop-in replacement for many RegExp use cases
- Native performance via TRE C library

## Installation

```sh
npm install @credit-app/fuzzy-regex
```

> **Note:** This package includes native bindings and requires a C++ build toolchain. On first install, it will build the TRE library from source. Ensure you have `make`, a C++ compiler, and Python (for `node-gyp`) available on your system.

## Usage

```js
import { fuzzyRegex } from "@credit-app/fuzzy-regex";
// or: const { fuzzyRegex } = require('@credit-app/fuzzy-regex');

// Create a fuzzy regex (case-insensitive by default)
const regex = fuzzyRegex("foo");

console.log(regex.test("moo")); // true (1 substitution allowed)
console.log(regex.test("mow")); // false

// Override case sensitivity
const csRegex = fuzzyRegex("Foo", false);
console.log(csRegex.test("foo")); // false

// Control the maximum number of errors
console.log(regex.test("foa", 2)); // true
console.log(regex.test("faa", 1)); // false

// Use .exec to extract groups
const pageRegex = fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)");
const result = pageRegex.exec("page I of 6");
console.log(result[1]); // 'I'
console.log(result[2]); // '6'
```

## API

### `fuzzyRegex(pattern: string | RegExp, caseInsensitive?: boolean): FuzzyRegex`

- `pattern`: The regex pattern (string or RegExp)
- `caseInsensitive`: Optional, defaults to `true` unless a RegExp is passed
- Returns: `{ test(str, maxErrors?), exec(str, maxErrors?) }`

- `test(str, maxErrors?)`: Returns `true` if `str` matches `pattern` within the allowed number of errors
- `exec(str, maxErrors?)`: Returns an array of matched groups or `null`

## Contributing

Contributions are welcome! Please open an issue or pull request on GitHub. To develop locally:

```sh
git clone <repo-url>
npm install
npm test
```

- Ensure you have a working C++ build environment
- Tests are written with Jest (`npm test`)

## License

MIT License. See [LICENSE](./LICENSE) for details.

## Acknowledgments

- [TRE](https://laurikari.net/tre/) - The underlying approximate regex engine
- Inspired by the need for fast, flexible fuzzy matching in Node.js
