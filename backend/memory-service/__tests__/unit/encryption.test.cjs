describe("memory encryption adapter", () => {
  it("encrypts authenticated content without retaining plaintext", async () => {
    process.env.APP_ENV = "test";
    const { AesGcmEncryptionAdapter } = await import("../../dist/infrastructure/encryption.js");
    const encryption = new AesGcmEncryptionAdapter();
    const encrypted = encryption.encrypt("private memory content");
    expect(encrypted.toString("utf8")).not.toContain("private memory content");
    expect(encryption.decrypt(encrypted)).toBe("private memory content");
    expect(() =>
      encryption.decrypt(Buffer.from(encrypted).fill(0, encrypted.length - 1)),
    ).toThrow();
  });
});
