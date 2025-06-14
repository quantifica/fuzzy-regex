import { TreClass } from "./types";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const path = "./tre.node";
const addon = require(path);

let TreLib: typeof TreClass | undefined;

if (typeof addon === "object") {
  TreLib = addon.Tre;
}
if (typeof addon === "string") {
  TreLib = require(addon).Tre;
}

if (!TreLib) {
  throw new Error("Failed to load tre");
}

export const Tre = TreLib;
