export class TreClass {
  constructor(pattern: string, insensitive?: boolean);
  fuzzy(str: string, options?: {
    costIns?: number;
    costDel?: number;
    costSubst?: number;
    maxCost?: number;
    maxIns?: number;
    maxDel?: number;
    maxSubst?: number;
    maxErr?: number;
  }): boolean;
  fuzzyExec(str: string, options?: {
    costIns?: number;
    costDel?: number;
    costSubst?: number;
    maxCost?: number;
    maxIns?: number;
    maxDel?: number;
    maxSubst?: number;
    maxErr?: number;
  }): string[] | null;
}
