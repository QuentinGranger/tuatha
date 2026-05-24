// ─── File Encryption at Rest ───
//
// AES-256-GCM encryption for uploaded files (documents, videos, avatars).
// Uses the same ENCRYPTION_KEY as field-level encryption.
//
// Storage format: [16 bytes IV][16 bytes authTag][...ciphertext]
// The encrypted file replaces the plaintext file on disk.
//
// Usage:
//   await encryptFile("/uploads/doc.pdf");       // encrypts in-place, appends .enc
//   await decryptFileToBuffer("/uploads/doc.pdf.enc");  // returns decrypted Buffer
//   const stream = decryptFileToStream("/uploads/doc.pdf.enc"); // returns readable stream

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { readFile, writeFile, rename, unlink, access } from "fs/promises";
import { createReadStream, createWriteStream } from "fs";
import { Transform, Readable } from "stream";
import { pipeline } from "stream/promises";
import { secrets } from "@/lib/vault";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = secrets.encryptionKey();
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters.");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a file in-place. Original file is replaced with encrypted version.
 * Adds .enc extension to the file path.
 * Returns the new file path (with .enc extension).
 */
export async function encryptFile(filePath: string): Promise<string> {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const plaintext = await readFile(filePath);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: [IV][authTag][ciphertext]
  const output = Buffer.concat([iv, authTag, encrypted]);
  const encPath = filePath + ".enc";

  await writeFile(encPath, output);
  await unlink(filePath); // Remove plaintext

  return encPath;
}

/**
 * Encrypt a buffer and write to the given path (with .enc extension).
 * Returns the encrypted file path.
 */
export async function encryptBuffer(data: Buffer, filePath: string): Promise<string> {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const output = Buffer.concat([iv, authTag, encrypted]);
  const encPath = filePath.endsWith(".enc") ? filePath : filePath + ".enc";

  await writeFile(encPath, output);
  return encPath;
}

/**
 * Decrypt an encrypted file and return its contents as a Buffer.
 */
export async function decryptFileToBuffer(encPath: string): Promise<Buffer> {
  const key = getKey();
  const data = await readFile(encPath);

  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted file too short.");
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Check if a file exists at the given path.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Smart file reader: if .enc version exists, decrypt it; otherwise read plaintext.
 * This allows gradual migration of existing files.
 */
export async function readFileAuto(filePath: string): Promise<Buffer> {
  const encPath = filePath + ".enc";
  if (await fileExists(encPath)) {
    return decryptFileToBuffer(encPath);
  }
  return readFile(filePath);
}

/**
 * Smart file path resolver: returns .enc path if encrypted version exists.
 */
export async function resolveFilePath(filePath: string): Promise<string> {
  const encPath = filePath + ".enc";
  if (await fileExists(encPath)) {
    return encPath;
  }
  return filePath;
}

/**
 * Check if a file is encrypted (has .enc extension and valid header).
 */
export function isEncryptedFile(filePath: string): boolean {
  return filePath.endsWith(".enc");
}
