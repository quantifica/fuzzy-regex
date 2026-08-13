/*
  Loader for src/generated/tre.wasm.

  The module is built with -sSTANDALONE_WASM, so there is no Emscripten JS glue:
  the only import it needs is emscripten_notify_memory_growth, stubbed below to
  refresh the typed-array views. The binary is embedded as base64 in
  ./generated/tre-wasm so the package has no runtime file or network lookup and
  works unchanged in Node, browsers, workers, Deno, Bun and bundlers.

  Strings cross the boundary as UTF-32, one Int32 per code point, matching
  wchar_t under Emscripten. See the header comment in bindings/tre_wasm.c for
  why the wide-character entry points are used instead of the UTF-8 ones.
*/

import { TRE_WASM_BASE64 } from "./generated/tre-wasm";

/* Index of each field in the int array handed to fr_exec.
   Kept in sync with the FR_PARAM_* enum in bindings/tre_wasm.c. */
const FR_PARAM_COUNT = 8;
const FR_PARAM_COST_INS = 0;
const FR_PARAM_COST_DEL = 1;
const FR_PARAM_COST_SUBST = 2;
const FR_PARAM_MAX_COST = 3;
const FR_PARAM_MAX_INS = 4;
const FR_PARAM_MAX_DEL = 5;
const FR_PARAM_MAX_SUBST = 6;
const FR_PARAM_MAX_ERR = 7;

/* Kept in sync with FR_EINVAL in bindings/tre_wasm.c. */
const FR_EINVAL = -1000;

export type TreParams = {
  costIns: number;
  costDel: number;
  costSubst: number;
  maxCost: number;
  maxIns: number;
  maxDel: number;
  maxSubst: number;
  maxErr: number;
};

type TreExports = {
  memory: WebAssembly.Memory;
  _initialize: () => void;
  malloc: (size: number) => number;
  free: (ptr: number) => void;
  fr_compile: (patternPtr: number, len: number, caseInsensitive: number) => number;
  fr_free: (handle: number) => void;
  fr_last_error_code: () => number;
  fr_last_error_message: () => number;
  fr_nsub: (handle: number) => number;
  fr_exec: (
    handle: number,
    strPtr: number,
    len: number,
    paramsPtr: number,
    outPtr: number,
    nmatch: number
  ) => number;
};

/** Options for {@link init}. */
export type InitOptions = {
  /**
   * A compiled module or raw bytes to use instead of the embedded binary.
   * Supplying an already-compiled `WebAssembly.Module` lets a host compile once
   * and share it across workers.
   */
  module?: WebAssembly.Module | ArrayBuffer | Uint8Array;
};

/**
 * One instantiated copy of the wasm module, plus the scratch buffers and heap
 * views used to talk to it.
 *
 * Safe to share across all regexes on a thread: every call into wasm is
 * synchronous and runs no user code, so nothing can observe or re-enter a call
 * mid-flight and the scratch buffers cannot be aliased.
 */
export class TreModule {
  private readonly exports: TreExports;

  /** Refreshed by onMemoryGrowth; memory growth detaches the old buffer. */
  private heapU8!: Uint8Array;
  private heapI32!: Int32Array;

  /** fr_exec's param block. Fixed size, so allocated once. */
  private readonly paramsPtr: number;

  /** UTF-32 staging buffer for subject strings; grown on demand. */
  private strPtr = 0;
  private strCapacity = 0;

  constructor(instance: WebAssembly.Instance) {
    this.exports = instance.exports as unknown as TreExports;
    this.refreshViews();
    /* Reactor module: runs static initialisers. Must precede any other call. */
    this.exports._initialize();

    this.paramsPtr = this.exports.malloc(FR_PARAM_COUNT * 4);
    if (this.paramsPtr === 0) {
      throw new Error("fuzzy-regex: failed to allocate wasm scratch memory");
    }
  }

  /** Called from the wasm import when linear memory grows. */
  refreshViews(): void {
    const buffer = this.exports.memory.buffer;
    this.heapU8 = new Uint8Array(buffer);
    this.heapI32 = new Int32Array(buffer);
  }

  private grow(capacity: number): number {
    if (capacity <= this.strCapacity) {
      return this.strPtr;
    }
    /* Round up so a loop over strings of similar size reallocates rarely. */
    const next = Math.max(256, 1 << (32 - Math.clz32(capacity - 1)));
    if (this.strPtr !== 0) {
      this.exports.free(this.strPtr);
    }
    const ptr = this.exports.malloc(next * 4);
    if (ptr === 0) {
      this.strPtr = 0;
      this.strCapacity = 0;
      throw new Error(
        `fuzzy-regex: failed to allocate ${next * 4} bytes in wasm memory`
      );
    }
    this.strPtr = ptr;
    this.strCapacity = next;
    return ptr;
  }

  /**
   * Writes `str` into the shared staging buffer as UTF-32.
   * Returns the pointer and the length in code points.
   */
  private writeSubject(str: string): { ptr: number; length: number } {
    const ptr = this.grow(str.length || 1);
    /* malloc returns 4-byte-aligned memory, so the Int32Array index is exact. */
    const base = ptr >> 2;
    const heap = this.heapI32;
    let out = 0;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      /* Combine a well-formed surrogate pair into one code point. A lone
         surrogate is passed through as-is so it still round-trips. */
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        const low = str.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          heap[base + out++] = (code - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
          i++;
          continue;
        }
      }
      heap[base + out++] = code;
    }
    return { ptr, length: out };
  }

  /**
   * Writes `str` as UTF-32 into a freshly malloc'd block the caller owns.
   * Used for patterns, which TRE copies at compile time, so this is freed
   * immediately after; subjects use the shared buffer instead.
   */
  private withPattern<T>(str: string, fn: (ptr: number, length: number) => T): T {
    const bytes = Math.max(4, str.length * 4);
    const ptr = this.exports.malloc(bytes);
    if (ptr === 0) {
      throw new Error("fuzzy-regex: failed to allocate wasm memory for pattern");
    }
    try {
      const base = ptr >> 2;
      const heap = this.heapI32;
      let out = 0;
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
          const low = str.charCodeAt(i + 1);
          if (low >= 0xdc00 && low <= 0xdfff) {
            heap[base + out++] =
              (code - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
            i++;
            continue;
          }
        }
        heap[base + out++] = code;
      }
      return fn(ptr, out);
    } finally {
      this.exports.free(ptr);
    }
  }

  private writeParams(params: TreParams): number {
    const base = this.paramsPtr >> 2;
    const heap = this.heapI32;
    heap[base + FR_PARAM_COST_INS] = params.costIns;
    heap[base + FR_PARAM_COST_DEL] = params.costDel;
    heap[base + FR_PARAM_COST_SUBST] = params.costSubst;
    heap[base + FR_PARAM_MAX_COST] = params.maxCost;
    heap[base + FR_PARAM_MAX_INS] = params.maxIns;
    heap[base + FR_PARAM_MAX_DEL] = params.maxDel;
    heap[base + FR_PARAM_MAX_SUBST] = params.maxSubst;
    heap[base + FR_PARAM_MAX_ERR] = params.maxErr;
    return this.paramsPtr;
  }

  private readCString(ptr: number): string {
    if (ptr === 0) {
      return "";
    }
    let end = ptr;
    while (this.heapU8[end] !== 0) {
      end++;
    }
    return new TextDecoder().decode(this.heapU8.subarray(ptr, end));
  }

  /**
   * Compiles `pattern`. Returns an opaque handle that must be released with
   * {@link freeRegex}. Throws if the pattern is not valid POSIX ERE.
   */
  compile(pattern: string, caseInsensitive: boolean): number {
    const handle = this.withPattern(pattern, (ptr, length) =>
      this.exports.fr_compile(ptr, length, caseInsensitive ? 1 : 0)
    );
    if (handle === 0) {
      const code = this.exports.fr_last_error_code();
      const message = this.readCString(this.exports.fr_last_error_message());
      throw new SyntaxError(
        `fuzzy-regex: failed to compile pattern ${JSON.stringify(pattern)}: ${
          message || `error ${code}`
        }`
      );
    }
    return handle;
  }

  freeRegex(handle: number): void {
    this.exports.fr_free(handle);
  }

  /** Number of capture groups in the compiled pattern. */
  nsub(handle: number): number {
    return this.exports.fr_nsub(handle);
  }

  /** Allocates the (start, end) output block for a pattern with `nsub` groups. */
  allocOffsets(nsub: number): number {
    const ptr = this.exports.malloc((nsub + 1) * 2 * 4);
    if (ptr === 0) {
      throw new Error("fuzzy-regex: failed to allocate wasm match buffer");
    }
    return ptr;
  }

  freeOffsets(ptr: number): void {
    this.exports.free(ptr);
  }

  private checkExecStatus(status: number): void {
    if (status >= 0) {
      return;
    }
    if (status === FR_EINVAL) {
      throw new Error("fuzzy-regex: invalid arguments passed to wasm matcher");
    }
    throw new Error(`fuzzy-regex: match failed with TRE error ${-status}`);
  }

  /** Boolean match. Skips submatch tracking entirely. */
  test(handle: number, str: string, params: TreParams): boolean {
    const subject = this.writeSubject(str);
    const paramsPtr = this.writeParams(params);
    const status = this.exports.fr_exec(
      handle,
      subject.ptr,
      subject.length,
      paramsPtr,
      0,
      0
    );
    this.checkExecStatus(status);
    return status === 1;
  }

  /**
   * Match with capture groups. Returns one entry per group (index 0 is the whole
   * match), `undefined` for a group that did not participate, or `null` if the
   * subject does not match within the given cost.
   */
  exec(
    handle: number,
    str: string,
    params: TreParams,
    nsub: number,
    offsetsPtr: number
  ): (string | undefined)[] | null {
    const subject = this.writeSubject(str);
    const paramsPtr = this.writeParams(params);
    const nmatch = nsub + 1;
    const status = this.exports.fr_exec(
      handle,
      subject.ptr,
      subject.length,
      paramsPtr,
      offsetsPtr,
      nmatch
    );
    this.checkExecStatus(status);
    if (status !== 1) {
      return null;
    }

    /* Offsets are code-point indices. When the subject is all BMP they equal
       UTF-16 indices and str.slice can be used directly; otherwise map through
       the staged code points. */
    const isBmpOnly = subject.length === str.length;
    const heap = this.heapI32;
    const offsetsBase = offsetsPtr >> 2;
    const subjectBase = subject.ptr >> 2;

    const result: (string | undefined)[] = new Array(nmatch);
    for (let i = 0; i < nmatch; i++) {
      const start = heap[offsetsBase + 2 * i];
      const end = heap[offsetsBase + 2 * i + 1];
      if (start < 0 || end < 0) {
        /* Group did not participate in the match, as with JS RegExp. */
        result[i] = undefined;
        continue;
      }
      if (isBmpOnly) {
        result[i] = str.slice(start, end);
      } else {
        result[i] = codePointsToString(heap, subjectBase + start, end - start);
      }
    }
    return result;
  }
}

/** Rebuilds a string from `length` UTF-32 code points at `base` in `heap`. */
function codePointsToString(
  heap: Int32Array,
  base: number,
  length: number
): string {
  /* Chunked so a long match cannot overflow the argument limit of apply/spread. */
  const CHUNK = 4096;
  if (length <= CHUNK) {
    return String.fromCodePoint(...heap.subarray(base, base + length));
  }
  let out = "";
  for (let i = 0; i < length; i += CHUNK) {
    const end = Math.min(i + CHUNK, length);
    out += String.fromCodePoint(...heap.subarray(base + i, base + end));
  }
  return out;
}

function decodeBase64(base64: string): Uint8Array {
  /* Node and Bun. */
  if (typeof Buffer === "function" && typeof Buffer.from === "function") {
    const buf = Buffer.from(base64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  /* Browsers, workers, Deno. */
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  throw new Error(
    "fuzzy-regex: no base64 decoder available; pass a module via init({ module })"
  );
}

let modulePromise: Promise<TreModule> | undefined;

/**
 * Instantiates the wasm module. Called automatically by `fuzzyRegex`, so you
 * only need it to pre-warm, or to supply your own binary.
 *
 * The result is cached: repeated calls return the same module and ignore
 * later options.
 */
export function init(options?: InitOptions): Promise<TreModule> {
  if (modulePromise === undefined) {
    modulePromise = instantiate(options).catch((error: unknown) => {
      /* Don't cache a failure; a later call should be able to retry. */
      modulePromise = undefined;
      throw error;
    });
  }
  return modulePromise;
}

async function instantiate(options?: InitOptions): Promise<TreModule> {
  /* Assigned before instantiation completes, but the import can only be called
     from wasm code, which cannot run until after that. */
  let treModule: TreModule | undefined;
  const imports: WebAssembly.Imports = {
    env: {
      emscripten_notify_memory_growth: (): void => {
        treModule?.refreshViews();
      },
    },
  };

  const source = options?.module;
  let instance: WebAssembly.Instance;
  if (source instanceof WebAssembly.Module) {
    instance = await WebAssembly.instantiate(source, imports);
  } else {
    const bytes = source ?? decodeBase64(TRE_WASM_BASE64);
    instance = (await WebAssembly.instantiate(bytes as BufferSource, imports))
      .instance;
  }

  treModule = new TreModule(instance);
  return treModule;
}
