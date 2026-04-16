/**
 * AES-256-GCM encryption for sensitive data (API keys).
 * Requires LLM_ENCRYPTION_KEY env var (32-byte hex string).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer | null {
  const hex = process.env.LLM_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null; // 32 bytes = 64 hex chars
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt plaintext. Returns base64-encoded string (iv:ciphertext:tag).
 * If no encryption key is configured, returns plaintext as-is (development fallback).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext;

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${encrypted}:${tag.toString("base64")}`;
}

/**
 * Decrypt ciphertext. Expects base64-encoded string (iv:ciphertext:tag).
 * If input doesn't match encrypted format, returns as-is (handles unencrypted legacy data).
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  if (!key) return ciphertext;

  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext; // Not encrypted, return as-is

  const [ivB64, encB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encB64, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
