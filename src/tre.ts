import { TreClass } from "./types";
import { createRequire } from "module";

if (typeof require === "undefined") {
  global.require = createRequire(import.meta.url);
}

const addon = require("../build/Release/tre.node");

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
