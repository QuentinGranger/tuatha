// ─── Field-Level Encryption (At Rest) ───
// AES-256-GCM encryption for sensitive PII and medical data stored in the database.
//
// Usage:
//   const encrypted = encrypt("patient data");        // → "iv:authTag:ciphertext" (base64)
//   const decrypted = decrypt(encrypted);             // → "patient data"
//
// Requires ENCRYPTION_KEY in .env (64 hex chars = 32 bytes).
// Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { secrets } from "@/lib/vault";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;          // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16;    // 128-bit authentication tag
const ENCODING = "base64" as const;

// ─── Key management ───

function getEncryptionKey(): Buffer {
  const key = secrets.encryptionKey();
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).");
  }
  return Buffer.from(key, "hex");
}

// ─── Encrypt ───

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a string in format: "iv:authTag:ciphertext" (all base64-encoded).
 * Returns null if input is null/undefined.
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);

  const authTag = cipher.getAuthTag();

  return `${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted}`;
}

// ─── Decrypt ───

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Expects format: "iv:authTag:ciphertext" (all base64-encoded).
 * Returns null if input is null/undefined.
 * Throws on tampered data (GCM auth tag verification failure).
 */
export function decrypt(encryptedString: string | null | undefined): string | null {
  if (encryptedString == null) return null;

  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format. Expected 'iv:authTag:ciphertext'.");
  }

  const [ivB64, authTagB64, ciphertext] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, ENCODING);
  const authTag = Buffer.from(authTagB64, ENCODING);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, ENCODING, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// ─── Helpers ───

/** Check if a string looks like an encrypted value (iv:tag:cipher format) */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

/**
 * Encrypt a value only if it's not already encrypted.
 * Safe to call multiple times on the same value.
 */
export function ensureEncrypted(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (isEncrypted(value)) return value;
  return encrypt(value);
}

/**
 * Decrypt a value only if it looks encrypted.
 * Safe to call on already-decrypted values.
 */
export function ensureDecrypted(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    // If decryption fails, return the original value (might be plaintext)
    return value;
  }
}

// ─── Batch operations for model fields ───

type FieldMap = Record<string, string | null | undefined>;

/**
 * Encrypt specific fields in an object.
 * Returns a new object with the specified fields encrypted.
 */
export function encryptFields<T extends FieldMap>(data: T, fields: (keyof T)[]): T {
  const result = { ...data };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === "string") {
      (result as Record<string, unknown>)[field as string] = encrypt(value);
    }
  }
  return result;
}

/**
 * Decrypt specific fields in an object.
 * Returns a new object with the specified fields decrypted.
 */
export function decryptFields<T extends FieldMap>(data: T, fields: (keyof T)[]): T {
  const result = { ...data };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === "string" && isEncrypted(value)) {
      (result as Record<string, unknown>)[field as string] = decrypt(value);
    }
  }
  return result;
}

// ─── Sensitive fields registry ───
// Lists which model fields should be encrypted at rest.
// Use these constants when reading/writing to the database.

export const SENSITIVE_FIELDS = {
  athlete: [
    "contactEmail",
    "contactPhone",
    "antecedents",
    "traitements",
    "contreIndications",
    "injuryNote",
  ],
  professionnel: [
    "telephone",
  ],
  healthAppConnection: [
    "accessToken",
    "accessTokenSecret",
    "refreshToken",
  ],
} as const;

// ─── Data Classification (RGPD Art. 9) ───
// Tags each data category for audit, access control, and breach notification.

export type DataClassification = "health" | "sport" | "payment" | "identity" | "technical" | "communication";

export const DATA_CLASSIFICATION: Record<string, { fields: readonly string[]; classification: DataClassification; rgpdBasis: string }> = {
  athlete_medical: {
    fields: ["antecedents", "traitements", "contreIndications", "injuryNote"],
    classification: "health",
    rgpdBasis: "RGPD Art. 9(2)(h) — médecine préventive/du travail, diagnostic médical",
  },
  athlete_identity: {
    fields: ["contactEmail", "contactPhone", "nom", "prenom", "dateNaissance"],
    classification: "identity",
    rgpdBasis: "RGPD Art. 6(1)(b) — exécution du contrat",
  },
  athlete_sport: {
    fields: ["sport", "objectif", "taille", "poids", "bodyZone", "frequence"],
    classification: "sport",
    rgpdBasis: "RGPD Art. 6(1)(b) — exécution du contrat de suivi sportif",
  },
  health_data: {
    fields: ["heart_rate", "hrv", "spo2", "sleep", "body_temperature", "stress"],
    classification: "health",
    rgpdBasis: "RGPD Art. 9(2)(a) — consentement explicite pour données de santé connectée",
  },
  health_activity: {
    fields: ["steps", "calories", "distance", "active_minutes"],
    classification: "sport",
    rgpdBasis: "RGPD Art. 6(1)(a) — consentement pour données d'activité",
  },
  payment: {
    fields: ["stripeCustomerId", "stripePaymentId", "amount"],
    classification: "payment",
    rgpdBasis: "RGPD Art. 6(1)(b) — exécution du contrat ; PCI-DSS",
  },
  oauth_tokens: {
    fields: ["accessToken", "refreshToken", "accessTokenSecret"],
    classification: "technical",
    rgpdBasis: "RGPD Art. 6(1)(b) — nécessaire à la connexion aux services tiers",
  },
  communication: {
    fields: ["content", "attachments"],
    classification: "communication",
    rgpdBasis: "RGPD Art. 6(1)(b) — communication patient-professionnel",
  },
};

/**
 * Get the classification for a given data field.
 * Returns the most sensitive classification if the field appears in multiple categories.
 */
export function classifyField(fieldName: string): DataClassification | null {
  const PRIORITY: DataClassification[] = ["health", "payment", "identity", "communication", "sport", "technical"];
  for (const cls of PRIORITY) {
    for (const cat of Object.values(DATA_CLASSIFICATION)) {
      if (cat.classification === cls && cat.fields.includes(fieldName)) {
        return cls;
      }
    }
  }
  return null;
}

// ─── Health Token helpers ───
// Convenience wrappers for encrypting/decrypting OAuth tokens on HealthAppConnection.

/** Encrypt health connection tokens before writing to DB */
export function encryptHealthTokens(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const field of SENSITIVE_FIELDS.healthAppConnection) {
    if (typeof result[field] === "string") {
      result[field] = encrypt(result[field] as string);
    }
  }
  return result;
}

/** Decrypt health connection tokens after reading from DB */
export function decryptHealthTokens<T extends Record<string, unknown>>(conn: T): T {
  const result = { ...conn };
  for (const field of SENSITIVE_FIELDS.healthAppConnection) {
    const val = result[field as keyof T];
    if (typeof val === "string" && isEncrypted(val)) {
      try {
        (result as Record<string, unknown>)[field] = decrypt(val);
      } catch {
        // If decryption fails, token may already be plaintext (pre-migration)
      }
    }
  }
  return result;
}
