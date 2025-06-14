import { Tre } from "./tre";

export type FuzzyRegex = {
  test: (str: string, maxErrors?: number) => boolean;
  exec: (str: string, maxErrors?: number) => string[] | null;
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
