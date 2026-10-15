/**
 * Sammelt die Drizzle-Schemata aller Module. drizzle-kit liest die Modul-Dateien
 * direkt (siehe drizzle.config.ts); die App nutzt diesen Export für den typisierten Client.
 */
export * from "@/modules/auth/schema";
export * from "@/modules/manuals/schema";
export * from "@/modules/projects/schema";
export * from "@/modules/progress/schema";
export * from "@/modules/audit/schema";
