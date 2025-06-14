import { createRequire } from "module";
import TreAddon, { TreType } from "tre";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TreLib: TreType;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (TreAddon && typeof TreAddon === "object") {
    TreLib = TreAddon.Tre;
  }
  if (TreAddon && typeof TreAddon === "string") {
    TreLib = require(TreAddon).Tre;
  }
} catch {
  const require = createRequire(import.meta.url);
  TreLib = require(TreAddon as unknown as string).Tre;
}

export const Tre = TreLib;
