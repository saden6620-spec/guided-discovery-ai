describe("Navigation encryption", () => {
  it("protects route geometry with authenticated encryption", async () => {
    process.env.NAVIGATION_ENCRYPTION_KEY = "test-key";
    const { AesGcmEncryptionAdapter } = await import("../../dist/infrastructure/encryption.js");
    const adapter = new AesGcmEncryptionAdapter();
    const encrypted = adapter.encrypt("precise-route-geometry");
    expect(encrypted.toString("utf8")).not.toContain("precise-route-geometry");
    expect(adapter.decrypt(encrypted)).toBe("precise-route-geometry");
  });
});
