import { createRequire } from "module";
import { TreClass } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let TreLib: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const addon = require("../build/Release/tre.node");
  if (addon && typeof addon === "object") {
    TreLib = addon.Tre;
  }
  if (addon && typeof addon === "string") {
    const require = createRequire(import.meta.url);
    TreLib = require(addon).Tre;
  }
} catch {
  const require = createRequire(import.meta.url);
  TreLib = require("../build/Release/tre.node").Tre;
}

export const Tre = TreLib as typeof TreClass;
