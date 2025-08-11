import { Tre } from "./tre";

export type FuzzyRegex = {
  test: (str: string, maxErrors?: number) => boolean;
  exec: (str: string, maxErrors?: number) => string[] | null;
};

export type FuzzyRegexWithMaxErrors = FuzzyRegex & {
  toString: () => string;
};

export function fuzzyRegex(
  pattern: string | RegExp,
  caseInsensitive?: boolean
): FuzzyRegex {
  const patternString = pattern instanceof RegExp ? pattern.source : pattern;
  let insensitive = true;
  if (caseInsensitive !== undefined) {
    insensitive = caseInsensitive;
  } else if (pattern instanceof RegExp) {
    insensitive = pattern.ignoreCase;
  }

  if (
    caseInsensitive !== undefined &&
    pattern instanceof RegExp &&
    pattern.ignoreCase !== caseInsensitive
  ) {
    throw new Error("Case sensitivity mismatch");
  }

  const tre = new Tre(patternString, insensitive);
  return {
    test: (str: string, maxErrors?: number): boolean => {
      let errs = 0;
      if (maxErrors === undefined) {
        const min = Math.min(str.length, patternString.length);
        errs = Math.floor(min / 5) + (min % 5 > 2 ? 1 : 0);
      } else {
        errs = maxErrors;
      }
      return tre.fuzzy(str, errs);
    },
    exec: (str: string, maxErrors?: number): string[] | null => {
      let errs = 0;
      if (maxErrors === undefined) {
        const min = Math.min(str.length, patternString.length);
        errs = Math.floor(min / 5) + (min % 5 > 2 ? 1 : 0);
      } else {
        errs = maxErrors;
      }
      return tre.fuzzyExec(str, errs);
    },
  };
}

/**
 * Create a fuzzy regex with a preset maxErrors tolerance.
 * The returned matcher ignores any maxErrors passed to its methods and always uses the preset value.
 */
export function fuzzyRegexWithMaxErrors(
  pattern: string | RegExp,
  maxErrors?: number
): FuzzyRegexWithMaxErrors {
  const matcher = fuzzyRegex(pattern);
  const patternLabel =
    pattern instanceof RegExp ? pattern.toString() : String(pattern);
  return {
    test: (str: string): boolean => matcher.test(str, maxErrors),
    exec: (str: string): string[] | null => matcher.exec(str, maxErrors),
    toString: () => `fuzzyRegex<${patternLabel}>`,
  };
}
