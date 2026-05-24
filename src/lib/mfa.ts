// ─── MFA Utilities ───
//
// Shared utilities for TOTP 2FA, recovery codes, and MFA step-up verification.
//
// CNIL 2025 recommendation: MFA with privacy by design.
//   - TOTP (RFC 6238) via otpauth library
//   - Recovery codes: 10 single-use codes, bcrypt-hashed
//   - MFA step-up: re-verify for sensitive actions (export, delete, email change)

import * as OTPAuth from "otpauth";
import bcrypt from "bcrypt";
import crypto from "crypto";

// ─── TOTP helpers ───

export function createTOTP(email: string, secret?: OTPAuth.Secret): { totp: OTPAuth.TOTP; secret: OTPAuth.Secret } {
  const s = secret ?? new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: "Tuatha",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: s,
  });
  return { totp, secret: s };
}

export function verifyTOTP(totpSecret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: "Tuatha",
    label: "user",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(totpSecret),
  });
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

// ─── Recovery codes ───

const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 8;

/**
 * Generate a set of recovery codes.
 * Returns { plain: string[], hashed: string[] }
 * plain = shown to user once, hashed = stored in DB.
 */
export async function generateRecoveryCodes(): Promise<{ plain: string[]; hashed: string[] }> {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = crypto.randomBytes(RECOVERY_CODE_LENGTH / 2).toString("hex").toUpperCase();
    // Format: XXXX-XXXX for readability
    const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
    plain.push(formatted);
    const hash = await bcrypt.hash(formatted, 10);
    hashed.push(hash);
  }

  return { plain, hashed };
}

/**
 * Verify a recovery code against the stored hashed codes.
 * Returns the index of the matched code (to remove it), or -1 if no match.
 */
export async function verifyRecoveryCode(code: string, hashedCodes: string[]): Promise<number> {
  const normalized = code.trim().toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(normalized, hashedCodes[i]);
    if (match) return i;
  }
  return -1;
}

// ─── MFA step-up verification ───
//
// For sensitive actions, the user must re-confirm identity with:
//   1. TOTP code (if 2FA is enabled)
//   2. OR a recovery code
//   3. OR password (if 2FA is not enabled — fallback)
//
// Returns { verified: boolean, method: string, error?: string }

export interface MfaStepUpResult {
  verified: boolean;
  method: "totp" | "recovery" | "password" | "none";
  error?: string;
  recoveryCodeIndex?: number; // index to consume if recovery code was used
}

export interface MfaStepUpInput {
  totpCode?: string;
  recoveryCode?: string;
  password?: string;
}

/**
 * Verify MFA step-up for a sensitive action.
 *
 * @param input - The verification input from the user
 * @param userRecord - The user's stored 2FA state
 */
export async function verifyMfaStepUp(
  input: MfaStepUpInput,
  userRecord: {
    twoFactorEnabled: boolean;
    totpSecret: string | null;
    recoveryCodes: string[];
    password: string;
  },
): Promise<MfaStepUpResult> {
  // If 2FA is enabled, require TOTP or recovery code
  if (userRecord.twoFactorEnabled && userRecord.totpSecret) {
    // Try TOTP first
    if (input.totpCode) {
      const valid = verifyTOTP(userRecord.totpSecret, input.totpCode);
      if (valid) return { verified: true, method: "totp" };
      return { verified: false, method: "totp", error: "Code 2FA invalide." };
    }

    // Try recovery code
    if (input.recoveryCode) {
      const idx = await verifyRecoveryCode(input.recoveryCode, userRecord.recoveryCodes);
      if (idx >= 0) return { verified: true, method: "recovery", recoveryCodeIndex: idx };
      return { verified: false, method: "recovery", error: "Code de secours invalide." };
    }

    return { verified: false, method: "none", error: "Code 2FA ou code de secours requis." };
  }

  // If 2FA is NOT enabled, accept password as fallback
  if (input.password) {
    const valid = await bcrypt.compare(input.password, userRecord.password);
    if (valid) return { verified: true, method: "password" };
    return { verified: false, method: "password", error: "Mot de passe incorrect." };
  }

  return { verified: false, method: "none", error: "Mot de passe requis." };
}

// ─── Sensitive actions requiring MFA step-up ───

export const MFA_SENSITIVE_ACTIONS = [
  "export_data",
  "delete_account",
  "change_email",
] as const;

export type MfaSensitiveAction = (typeof MFA_SENSITIVE_ACTIONS)[number];
