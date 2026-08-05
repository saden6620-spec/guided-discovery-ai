import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { EncryptionAdapter } from "../application/ports.js";
@Injectable()
export class AesGcmEncryptionAdapter implements EncryptionAdapter {
  private readonly key = createHash("sha256")
    .update(process.env.DOCUMENTATION_ENCRYPTION_KEY ?? "documentation-development-key-change-me")
    .digest();
  encrypt(value: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv),
      body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }
  decrypt(value: Buffer) {
    const decipher = createDecipheriv("aes-256-gcm", this.key, value.subarray(0, 12));
    decipher.setAuthTag(value.subarray(12, 28));
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8");
  }
}
