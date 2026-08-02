describe("Recommendation encryption", () => {
  it("round trips without plaintext persistence", async () => {
    process.env.RECOMMENDATION_ENCRYPTION_KEY = "unit-test-key";
    const { AesGcmEncryptionAdapter } = await import("../../dist/infrastructure/encryption.js"),
      adapter = new AesGcmEncryptionAdapter(),
      cipher = adapter.encrypt("sensitive rationale");
    expect(cipher.toString()).not.toContain("sensitive rationale");
    expect(adapter.decrypt(cipher)).toBe("sensitive rationale");
  });
});
