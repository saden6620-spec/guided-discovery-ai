import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { EncryptionAdapter } from "../application/ports.js";
@Injectable()
export class AesGcmEncryptionAdapter implements EncryptionAdapter {
  private readonly key = createHash("sha256")
    .update(process.env.NAVIGATION_ENCRYPTION_KEY ?? "navigation-development-key-change-me")
    .digest();
  encrypt(value: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }
  decrypt(value: Buffer): string {
    const decipher = createDecipheriv("aes-256-gcm", this.key, value.subarray(0, 12));
    decipher.setAuthTag(value.subarray(12, 28));
    return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8");
  }
}
