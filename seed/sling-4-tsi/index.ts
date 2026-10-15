import type { SeedAircraftModel } from "../types";
import { aliases } from "./aliases";
import { manuals } from "./manuals";
import { assemblyGroups, optionDimensions, optionGroups } from "./options";

export const sling4Tsi: SeedAircraftModel = {
  code: "sling-4-tsi",
  name: "Sling 4 TSi",
  manufacturer: "Sling Aircraft",
  assemblyGroups,
  optionGroups,
  optionDimensions,
  manuals,
  aliases,
};
