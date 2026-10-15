import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "./env";

/**
 * Verschlüsselung für Integrations-Tokens (AES-256-GCM).
 * Format: base64(iv[12] | tag[16] | ciphertext)
 */
function key(): Buffer {
  const raw = env().APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY fehlt (32 Bytes, base64).");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY muss 32 Bytes (base64) lang sein.");
  }
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** SHA-256 als Hex, z. B. für Token-Hashes. */
export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Zufälliges, URL-sicheres Token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
