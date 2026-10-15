import { hash, verify } from "@node-rs/argon2";

/** argon2id mit Parametern nach OWASP (m=19 MiB, t=2, p=1). */
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(hashValue: string, password: string): Promise<boolean> {
  try {
    return await verify(hashValue, password);
  } catch {
    return false;
  }
}

export const PASSWORD_MIN_LENGTH = 10;
