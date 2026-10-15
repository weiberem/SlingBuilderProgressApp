import { readFileSync } from "node:fs";
import path from "node:path";

export const authFile = path.join(process.cwd(), "e2e", ".auth", "user.json");
export const projectFile = path.join(process.cwd(), "e2e", ".auth", "project.json");

export const messages = (ns: string) => JSON.parse(readFileSync(path.join(process.cwd(), "messages", "de", `${ns}.json`), "utf8"));

export function projectId(): string {
  return JSON.parse(readFileSync(projectFile, "utf8")).projectId as string;
}
