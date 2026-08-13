import { init, initSync, TreModule, type TreParams } from "./wasm";

export { init, initSync };
export type { InitOptions } from "./wasm";

export type FuzzyRegex = {
  /** True if `str` matches within the allowed number of errors. */
  test: (str: string) => boolean;
  /**
   * The matched text and capture groups, or `null` if `str` does not match
   * within the allowed number of errors. Index 0 is the whole match; a group
   * that did not participate in the match is `undefined`, as with `RegExp`.
   */
  exec: (str: string) => (string | undefined)[] | null;
  /** The pattern source. */
  toString: () => string;
  /**
   * Releases the compiled pattern's wasm memory. Optional: a dropped regex is
   * reclaimed automatically once the garbage collector runs. Call it to release
   * eagerly when compiling many short-lived patterns.
   *
   * `Symbol.dispose` is also set to this, so a `using` declaration works on
   * runtimes with explicit resource management. It is left out of this type so
   * the published declarations do not require `lib: esnext.disposable`.
   *
   * Using the regex after this throws. Calling it more than once is a no-op.
   */
  free: () => void;
};

export type FuzzyRegexOptions = {
  caseInsensitive?: boolean;
  costIns?: number;
  costDel?: number;
  costSubst?: number;
  maxCost?: number;
  maxIns?: number;
  maxDel?: number;
  maxSubst?: number;
  maxErr?: number;
};

/* Symbol.dispose is only in lib.esnext; fall back to the same registry key
   TypeScript's `using` downlevelling looks for, so this still compiles and runs
   on toolchains and runtimes that predate it. */
const disposeSymbol: symbol =
  (Symbol as { dispose?: symbol }).dispose ?? Symbol.for("Symbol.dispose");

/**
 * Frees the wasm-side pattern if a FuzzyRegex is garbage collected without
 * `free()` having been called. Only a safety net: finalizers are not guaranteed
 * to run, so `free()` (or `using`) is still the right choice under load.
 *
 * The registered value must not reference the FuzzyRegex itself, or it would
 * keep it alive forever and the finalizer would never fire.
 */
type Finalized = { module: TreModule; state: RegexState };

const registry: FinalizationRegistry<Finalized> | undefined =
  typeof FinalizationRegistry === "function"
    ? new FinalizationRegistry<Finalized>(({ module, state }) => {
        releaseState(module, state);
      })
    : undefined;

type RegexState = {
  handle: number;
  offsetsPtr: number;
  freed: boolean;
};

function releaseState(module: TreModule, state: RegexState): void {
  if (state.freed) {
    return;
  }
  state.freed = true;
  module.freeOffsets(state.offsetsPtr);
  module.freeRegex(state.handle);
}

/**
 * Resolves the pattern source and case sensitivity, and rejects a `RegExp` whose
 * `i` flag contradicts an explicit `caseInsensitive` option.
 *
 * Deliberately separate from module instantiation so both entry points validate
 * their arguments identically, and so the async one reports a bad argument
 * without having compiled anything.
 */
function resolvePattern(
  pattern: string | RegExp,
  options?: FuzzyRegexOptions
): { patternString: string; insensitive: boolean } {
  const patternString = pattern instanceof RegExp ? pattern.source : pattern;
  let insensitive = true;
  if (options?.caseInsensitive !== undefined) {
    insensitive = options.caseInsensitive;
  } else if (pattern instanceof RegExp) {
    insensitive = pattern.ignoreCase;
  }

  if (
    options?.caseInsensitive !== undefined &&
    pattern instanceof RegExp &&
    pattern.ignoreCase !== options.caseInsensitive
  ) {
    throw new Error("Case sensitivity mismatch");
  }

  return { patternString, insensitive };
}

/**
 * Compiles a fuzzy regular expression.
 *
 * Async because it instantiates the WebAssembly module on first use, which
 * cannot be done synchronously on a browser main thread. Subsequent calls
 * resolve from a cached module. Use {@link init} to pre-warm, or
 * {@link fuzzyRegexSync} on Node.
 *
 * @param pattern POSIX extended regular expression, as a string or `RegExp`.
 *   Only a `RegExp`'s source and `i` flag are used; other flags are ignored.
 * @param options See {@link FuzzyRegexOptions}. Error allowances default to one
 *   per 10 characters of whichever is shorter, the pattern or the subject.
 */
export async function fuzzyRegex(
  pattern: string | RegExp,
  options?: FuzzyRegexOptions
): Promise<FuzzyRegex> {
  const { patternString, insensitive } = resolvePattern(pattern, options);
  return createRegex(await init(), patternString, insensitive, options);
}

/**
 * Synchronous {@link fuzzyRegex}, for Node.
 *
 * Instantiating WebAssembly synchronously is allowed in Node but not on a
 * browser main thread, where compiling a module this size synchronously is
 * refused. Calling this there throws with that explanation; use
 * {@link fuzzyRegex} instead. Everything else, including the returned object, is
 * identical. Both entry points share one wasm module, in either order.
 *
 * @param pattern POSIX extended regular expression, as a string or `RegExp`.
 *   Only a `RegExp`'s source and `i` flag are used; other flags are ignored.
 * @param options See {@link FuzzyRegexOptions}. Error allowances default to one
 *   per 10 characters of whichever is shorter, the pattern or the subject.
 */
export function fuzzyRegexSync(
  pattern: string | RegExp,
  options?: FuzzyRegexOptions
): FuzzyRegex {
  const { patternString, insensitive } = resolvePattern(pattern, options);
  return createRegex(initSync(), patternString, insensitive, options);
}

/** Shared by both entry points; everything below here is module-agnostic. */
function createRegex(
  module: TreModule,
  patternString: string,
  insensitive: boolean,
  options?: FuzzyRegexOptions
): FuzzyRegex {
  const handle = module.compile(patternString, insensitive);

  const nsub = module.nsub(handle);
  let offsetsPtr: number;
  try {
    offsetsPtr = module.allocOffsets(nsub);
  } catch (error) {
    module.freeRegex(handle);
    throw error;
  }

  const state: RegexState = { handle, offsetsPtr, freed: false };

  function getParams(str: string): TreParams {
    const min = Math.min(str.length, patternString.length);
    const defaultMaxErrs = Math.floor(min / 10) + (min % 10 > 5 ? 1 : 0);
    return {
      costIns: options?.costIns ?? 1,
      costDel: options?.costDel ?? 1,
      costSubst: options?.costSubst ?? 1,
      maxCost: options?.maxCost ?? defaultMaxErrs,
      maxIns: options?.maxIns ?? defaultMaxErrs,
      maxDel: options?.maxDel ?? defaultMaxErrs,
      maxSubst: options?.maxSubst ?? defaultMaxErrs,
      maxErr: options?.maxErr ?? defaultMaxErrs,
    };
  }

  function assertLive(): void {
    if (state.freed) {
      throw new Error("fuzzy-regex: this regex has been freed");
    }
  }

  const free = (): void => {
    releaseState(module, state);
    registry?.unregister(state);
  };

  const regex: FuzzyRegex = {
    test: (str: string): boolean => {
      assertLive();
      return module.test(state.handle, str, getParams(str));
    },
    exec: (str: string): (string | undefined)[] | null => {
      assertLive();
      return module.exec(
        state.handle,
        str,
        getParams(str),
        nsub,
        state.offsetsPtr
      );
    },
    toString: (): string => patternString,
    free,
  };

  /* Set separately rather than in the literal: see the note on `free` in the
     FuzzyRegex type for why the symbol is not part of the public type. */
  Object.defineProperty(regex, disposeSymbol, {
    value: free,
    enumerable: false,
    configurable: true,
  });

  /* `state` is the unregister token as well as part of the held value, so it
     must not be reachable from `regex` itself; the closures above capture it,
     which is fine because they die with `regex`. */
  registry?.register(regex, { module, state }, state);

  return regex;
}
