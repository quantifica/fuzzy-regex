import { Tre } from "./tre";

export type FuzzyRegex = {
  test: (str: string) => boolean;
  exec: (str: string) => string[] | null;
  toString: () => string;
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

export function fuzzyRegex(
  pattern: string | RegExp,
  options?: FuzzyRegexOptions
): FuzzyRegex {
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

  const tre = new Tre(patternString, insensitive);

  function getOptions(str: string): {
    costIns: number;
    costDel: number;
    costSubst: number;
    maxCost: number;
    maxIns: number;
    maxDel: number;
    maxSubst: number;
    maxErr: number;
  } {
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

  return {
    test: (str: string): boolean => {
      return tre.fuzzy(str, getOptions(str));
    },
    exec: (str: string): string[] | null => {
      return tre.fuzzyExec(str, getOptions(str));
    },
    toString: (): string => {
      return patternString;
    },
  };
}
