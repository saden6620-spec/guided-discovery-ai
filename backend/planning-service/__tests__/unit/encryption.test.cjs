describe("Planning encryption", () => {
  it("round trips protected content without storing plaintext", async () => {
    const { AesGcmEncryptionAdapter } = await import("../../dist/infrastructure/encryption.js");
    const adapter = new AesGcmEncryptionAdapter();
    const encrypted = adapter.encrypt("private note");
    expect(encrypted.toString("utf8")).not.toContain("private note");
    expect(adapter.decrypt(encrypted)).toBe("private note");
  });
});
