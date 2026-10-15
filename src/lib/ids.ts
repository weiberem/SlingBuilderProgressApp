import { uuidv7 } from "uuidv7";

/** Zeitlich sortierbare UUIDs (v7) für alle Primärschlüssel. */
export function newId(): string {
  return uuidv7();
}
