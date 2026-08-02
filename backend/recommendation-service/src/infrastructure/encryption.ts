import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { EncryptionAdapter } from "../application/ports.js";
@Injectable()
export class AesGcmEncryptionAdapter implements EncryptionAdapter {
  private readonly key = createHash("sha256")
    .update(process.env.RECOMMENDATION_ENCRYPTION_KEY ?? "recommendation-development-key-change-me")
    .digest();
  encrypt(v: string) {
    const iv = randomBytes(12),
      c = createCipheriv("aes-256-gcm", this.key, iv),
      b = Buffer.concat([c.update(v, "utf8"), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), b]);
  }
  decrypt(v: Buffer) {
    const d = createDecipheriv("aes-256-gcm", this.key, v.subarray(0, 12));
    d.setAuthTag(v.subarray(12, 28));
    return Buffer.concat([d.update(v.subarray(28)), d.final()]).toString("utf8");
  }
}
