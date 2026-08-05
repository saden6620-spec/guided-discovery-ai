const { test, expect } = require("@jest/globals");
test("journal encryption round trips without plaintext", async () => {
  const { AesGcmEncryptionAdapter } = await import("../../dist/infrastructure/encryption.js");
  const e = new AesGcmEncryptionAdapter(),
    v = e.encrypt("private reflection");
  expect(v.toString()).not.toContain("private reflection");
  expect(e.decrypt(v)).toBe("private reflection");
});
