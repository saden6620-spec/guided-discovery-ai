import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { EncryptionAdapter } from "../application/ports.js";

@Injectable()
export class AesGcmEncryptionAdapter implements EncryptionAdapter {
  private readonly key: Buffer;
  constructor() {
    const encoded = process.env.PLANNING_ENCRYPTION_KEY;
    if (encoded === undefined) {
      if ((process.env.APP_ENV ?? "development") === "production")
        throw new Error("PLANNING_ENCRYPTION_KEY is required in production.");
      this.key = Buffer.alloc(32, 9);
    } else {
      this.key = Buffer.from(encoded, "base64");
      if (this.key.length !== 32)
        throw new Error("PLANNING_ENCRYPTION_KEY must decode to 32 bytes.");
    }
  }
  encrypt(value: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), ciphertext]);
  }
  decrypt(value: Buffer): string {
    if (value.length < 29 || value[0] !== 1)
      throw new Error("Encrypted planning envelope is invalid.");
    const decipher = createDecipheriv("aes-256-gcm", this.key, value.subarray(1, 13));
    decipher.setAuthTag(value.subarray(13, 29));
    return Buffer.concat([decipher.update(value.subarray(29)), decipher.final()]).toString("utf8");
  }
}
