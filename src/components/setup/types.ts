import type { OptionAnswer } from "@/modules/projects/schema";

/** Serialisierbare Sicht auf eine Achse für die Client-Komponenten des Wizards. */
export type DimensionDto = {
  id: string;
  code: string;
  kind: "single" | "multi" | "bool" | "text";
  label: string;
  help: string | null;
  required: boolean;
  values: { code: string; label: string; help: string | null }[];
  answer: OptionAnswer | null;
};

export type BuildTypeDto = {
  group: string;
  label: string;
  buildType: "standard" | "quick_build" | "unknown";
};

export type DeviationDto = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: "planned" | "in_progress" | "done" | "dropped";
};

export type SetupChange =
  | { kind: "option"; dimensionCode: string; answer: OptionAnswer }
  | { kind: "buildType"; assemblyGroup: string; buildType: "standard" | "quick_build" | "unknown" };
