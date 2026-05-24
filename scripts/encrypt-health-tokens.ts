#!/usr/bin/env npx ts-node
/**
 * One-time migration script: encrypt existing plaintext OAuth tokens
 * in the HealthAppConnection table.
 *
 * Run with: npx ts-node scripts/encrypt-health-tokens.ts
 *
 * Safe to run multiple times — already-encrypted values are skipped.
 */

import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const ENCODING = "base64" as const;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error("ENCRYPTION_KEY env var must be 64 hex chars.");
  }
  return Buffer.from(key, "hex");
}

function isEncrypted(value: string | null): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);
  const authTag = cipher.getAuthTag();
  return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const connections = await prisma.healthAppConnection.findMany({
      select: { id: true, accessToken: true, accessTokenSecret: true, refreshToken: true, provider: true },
    });

    console.log(`Found ${connections.length} health connections.`);
    let migrated = 0;

    for (const conn of connections) {
      const updates: Record<string, string> = {};

      if (conn.accessToken && !isEncrypted(conn.accessToken)) {
        updates.accessToken = encrypt(conn.accessToken);
      }
      if (conn.accessTokenSecret && !isEncrypted(conn.accessTokenSecret)) {
        updates.accessTokenSecret = encrypt(conn.accessTokenSecret);
      }
      if (conn.refreshToken && !isEncrypted(conn.refreshToken)) {
        updates.refreshToken = encrypt(conn.refreshToken);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.healthAppConnection.update({
          where: { id: conn.id },
          data: updates,
        });
        migrated++;
        console.log(`  Encrypted tokens for ${conn.provider} connection ${conn.id}`);
      }
    }

    console.log(`\nDone. Migrated ${migrated}/${connections.length} connections.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
