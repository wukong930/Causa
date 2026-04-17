import { encrypt, decrypt } from "@/lib/crypto";

describe("crypto - no key", () => {
  beforeEach(() => {
    delete process.env.LLM_ENCRYPTION_KEY;
  });

  it("returns plaintext as-is when no key is set", () => {
    expect(encrypt("hello")).toBe("hello");
    expect(decrypt("hello")).toBe("hello");
  });
});

describe("crypto - with key", () => {
  const TEST_KEY = "a]b]c]d]e]f]0]1]2]3]4]5]6]7]8]9]a]b]c]d]e]f]0]1]2]3]4]5]6]7]8]9".replace(/]/g, "");
  // 64 hex chars = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"

  beforeEach(() => {
    process.env.LLM_ENCRYPTION_KEY = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  });

  afterEach(() => {
    delete process.env.LLM_ENCRYPTION_KEY;
  });

  it("encrypts to iv:ciphertext:tag format and decrypts back", () => {
    const plaintext = "my-secret-api-key";
    const encrypted = encrypt(plaintext);
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it("returns non-encrypted string as-is from decrypt", () => {
    // String with no colons is treated as unencrypted
    expect(decrypt("plain-no-colons")).toBe("plain-no-colons");
  });
});
