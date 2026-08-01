import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import type { EncryptionAdapter } from "../application/ports.js";

@Injectable()
export class AesGcmEncryptionAdapter implements EncryptionAdapter {
  readonly keyReference: string;
  private readonly key: Buffer;

  constructor() {
    this.keyReference = process.env.ENCRYPTION_KEY_REF ?? "local-development-key-v1";
    const encoded = process.env.MEMORY_ENCRYPTION_KEY;
    if (encoded === undefined) {
      if ((process.env.APP_ENV ?? "development") === "production")
        throw new Error("MEMORY_ENCRYPTION_KEY is required in production.");
      this.key = Buffer.alloc(32, 7);
    } else {
      this.key = Buffer.from(encoded, "base64");
      if (this.key.length !== 32) throw new Error("MEMORY_ENCRYPTION_KEY must decode to 32 bytes.");
    }
  }

  encrypt(plaintext: string): Buffer {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, initializationVector);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    return Buffer.concat([Buffer.from([1]), initializationVector, cipher.getAuthTag(), ciphertext]);
  }

  decrypt(envelope: Buffer): string {
    if (envelope.length < 29 || envelope[0] !== 1)
      throw new Error("Encrypted memory envelope is invalid.");
    const decipher = createDecipheriv("aes-256-gcm", this.key, envelope.subarray(1, 13));
    decipher.setAuthTag(envelope.subarray(13, 29));
    return Buffer.concat([decipher.update(envelope.subarray(29)), decipher.final()]).toString(
      "utf8",
    );
  }
}
