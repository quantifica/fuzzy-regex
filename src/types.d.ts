export class TreClass {
  constructor(pattern: string, caseInsensitive?: boolean);
  fuzzy(str: string, maxErrors?: number): boolean;
  fuzzyExec(str: string, maxErrors?: number): string[] | null;
}
