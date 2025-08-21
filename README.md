# fuzzy-regex

A regular expression library for Node.js that allows for a configurable number of mismatches (fuzzy matching), powered by the high-performance [TRE](https://laurikari.net/tre/) regex engine. This package supports both ESM and CommonJS, and provides a simple API for fuzzy string matching with regular expressions.

## Features

- Fuzzy matching with configurable error tolerance
- Case-insensitive or case-sensitive matching
- Drop-in replacement for many RegExp use cases
- Initialize with JS RegExp, allowing easy transition and familiar syntax
- Native performance via TRE C library

## Installation

```sh
npm install fuzzy-regex
```

> **Note:** This package includes native bindings and requires a C++ build toolchain. On first install, it will build the TRE library from source.
> Ensure you have `autopoint autoconf automake gettext libtool`, a C++ compiler, and Python (for `node-gyp`) available on your system.

## Usage

```js
import { fuzzyRegex } from "fuzzy-regex";
// or: const { fuzzyRegex } = require('fuzzy-regex');

// Create a fuzzy regex (case-insensitive by default)
const regex = fuzzyRegex("foo");

console.log(regex.test("moo")); // true (1 substitution allowed)
console.log(regex.test("mow")); // false

// Override case sensitivity
const csRegex = fuzzyRegex("Foo", { caseInsensitive: false });
console.log(csRegex.test("foo")); // false

// Control the maximum number of errors
const regexWithErrors = fuzzyRegex("foo", { maxErr: 2 });
console.log(regexWithErrors.test("foa")); // true
console.log(regexWithErrors.test("faa")); // false

// Use .exec to extract groups
const pageRegex = fuzzyRegex("page\\s+(\\d+)\\s+of\\s+(\\d+)");
const result = pageRegex.exec("page I of 6");
console.log(result[1]); // 'I'
console.log(result[2]); // '6'

// Initialize with JS RegExp
const jsRegex = fuzzyRegex(/page\s+(\d+)\s+of\s+(\d+)/); // will be case-sensitive without `i` flag
const jsResult = jsRegex.exec("page I of 6");
console.log(jsResult[1]); // 'I'
console.log(jsResult[2]); // '6'

// Case sensitive param mismatch
const mismatchRegex = fuzzyRegex(/Foo/i, { caseInsensitive: false }); // this will throw
```

## API

### `fuzzyRegex(pattern: string | RegExp, options?: Options): FuzzyRegex`

- `pattern`: The regex pattern (string or RegExp)
- `options`: Discussed below
- Returns: `{ test(str), exec(str) }`

- `test(str)`: Returns `true` if `str` matches `pattern` within the allowed number of errors (configured via options)
- `exec(str)`: Returns an array of matched groups or `null`

For both methods, the default number of errors defaults to 1 per 10 characters (rounded) of the smaller of the pattern and test string.

Example: `fuzzyRegex("lorem ipsum").test("Lo4em 1psum dolor sit amet"); // true, defaults to 2 allowed errors`

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
