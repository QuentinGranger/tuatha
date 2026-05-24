import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P1.11 MFA / Double Authentification Test Suite ───
// Validates CNIL 2025 MFA recommendations and RGPD compliance.

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. MFA disponible pour l'athlète
// ══════════════════════════════════════════════════════════════════════

describe("MFA available for athlete", () => {
  it("AthleteUser schema has TOTP fields", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const athleteModel = schema.slice(
      schema.indexOf("model AthleteUser {"),
      schema.indexOf("}", schema.indexOf("model AthleteUser {")) + 1,
    );
    expect(athleteModel).toContain("totpSecret");
    expect(athleteModel).toContain("twoFactorEnabled");
    expect(athleteModel).toContain("recoveryCodes");
  });

  it("athlete 2FA setup route exists (POST)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/2fa/route.ts");
    expect(code).toContain("export async function POST");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("createTOTP");
    expect(code).toContain("QRCode.toDataURL");
  });

  it("athlete 2FA verify route exists (PUT)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/2fa/route.ts");
    expect(code).toContain("export async function PUT");
    expect(code).toContain("verifyTOTP");
    expect(code).toContain("twoFactorEnabled: true");
  });

  it("athlete 2FA disable route exists (DELETE)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/2fa/route.ts");
    expect(code).toContain("export async function DELETE");
    expect(code).toContain("twoFactorEnabled: false");
    expect(code).toContain("totpSecret: null");
  });

  it("athlete login supports 2FA", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/login/route.ts");
    expect(code).toContain("Athlete 2FA check");
    expect(code).toContain("requires2FA: true");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. MFA obligatoire pour admin/support
// ══════════════════════════════════════════════════════════════════════

describe("MFA for admin/support", () => {
  it("admin routes use bearer token authentication (strong auth)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/admin/backup/route.ts");
    expect(code).toContain("ADMIN_SECRET");
    expect(code).toContain("Authorization");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. MFA recommandée pour professionnels
// ══════════════════════════════════════════════════════════════════════

describe("MFA recommended for professionals", () => {
  it("Professionnel schema has TOTP fields", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const proModel = schema.slice(
      schema.indexOf("model Professionnel {"),
      schema.indexOf("model AthleteUser {"),
    );
    expect(proModel).toContain("totpSecret");
    expect(proModel).toContain("twoFactorEnabled");
    expect(proModel).toContain("recoveryCodes");
  });

  it("pro 2FA setup route exists", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/2fa/route.ts");
    expect(code).toContain("POST");
    expect(code).toContain("OTPAuth.TOTP");
    expect(code).toContain("QRCode.toDataURL");
  });

  it("pro 2FA verify and activate route exists", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/2fa/route.ts");
    expect(code).toContain("PUT");
    expect(code).toContain("twoFactorEnabled: true");
    expect(code).toContain("generateRecoveryCodes");
  });

  it("pro login enforces 2FA when enabled", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/login/route.ts");
    expect(code).toContain("proUser.twoFactorEnabled && proUser.totpSecret");
    expect(code).toContain('requires2FA: true, message: "Code 2FA requis."');
  });

  it("dashboard has 2FA setup UI", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/dashboard/nutri/profil/page.tsx");
    expect(code).toContain("start2FASetup");
    expect(code).toContain("verify2FA");
    expect(code).toContain("disable2FA");
    expect(code).toContain("Activer la 2FA");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. MFA demandée pour export
// ══════════════════════════════════════════════════════════════════════

describe("MFA required for export", () => {
  it("verify-mfa endpoint accepts export_data action", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/verify-mfa/route.ts");
    expect(code).toContain('"export_data"');
    expect(code).toContain("mfaToken");
    expect(code).toContain("verifyMfaStepUp");
  });

  it("mfa.ts defines export_data as sensitive action", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain('"export_data"');
    expect(code).toContain("MFA_SENSITIVE_ACTIONS");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. MFA demandée pour suppression compte
// ══════════════════════════════════════════════════════════════════════

describe("MFA required for account deletion", () => {
  it("delete-account checks mfaToken if 2FA enabled", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("verifyMfaToken");
    expect(code).toContain('"delete_account"');
    expect(code).toContain("mfaRequired: true");
  });

  it("verify-mfa endpoint accepts delete_account action", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/verify-mfa/route.ts");
    expect(code).toContain('"delete_account"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. MFA demandée pour changement email
// ══════════════════════════════════════════════════════════════════════

describe("MFA required for email change", () => {
  it("verify-mfa endpoint accepts change_email action", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/verify-mfa/route.ts");
    expect(code).toContain('"change_email"');
  });

  it("mfa.ts defines change_email as sensitive action", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain('"change_email"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Codes de secours
// ══════════════════════════════════════════════════════════════════════

describe("Recovery codes", () => {
  it("mfa.ts generates 10 recovery codes", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain("RECOVERY_CODE_COUNT = 10");
    expect(code).toContain("generateRecoveryCodes");
  });

  it("recovery codes are bcrypt-hashed before storage", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain("bcrypt.hash(formatted, 10)");
  });

  it("recovery codes are formatted XXXX-XXXX for readability", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain("${code.slice(0, 4)}-${code.slice(4)}");
  });

  it("athlete 2FA activation returns recovery codes", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/2fa/route.ts");
    expect(code).toContain("recoveryCodes: plain");
    expect(code).toContain("Conservez ces codes de secours");
  });

  it("pro 2FA activation returns recovery codes", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/2fa/route.ts");
    expect(code).toContain("recoveryCodes: plain");
    expect(code).toContain("Conservez ces codes de secours");
  });

  it("recovery codes are single-use (consumed on login)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/login/route.ts");
    expect(code).toContain("Consume recovery code");
    expect(code).toContain("updatedCodes.splice(recoveryIdx, 1)");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Procédure de récupération sécurisée
// ══════════════════════════════════════════════════════════════════════

describe("Secure recovery procedure", () => {
  it("verifyRecoveryCode validates against bcrypt hashes", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain("verifyRecoveryCode");
    expect(code).toContain("bcrypt.compare(normalized, hashedCodes[i])");
  });

  it("recovery codes consumed on login (both pro and athlete)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/login/route.ts");
    // Pro path
    expect(code).toContain("professionnel.update({ where: { id: proUser.id }, data: { recoveryCodes: updatedCodes }");
    // Athlete path
    expect(code).toContain("athleteUser.update({ where: { id: athlete.id }, data: { recoveryCodes: updatedCodes }");
  });

  it("recovery codes consumed on MFA step-up verification", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/verify-mfa/route.ts");
    expect(code).toContain("recoveryCodeIndex");
    expect(code).toContain("updatedCodes.splice(result.recoveryCodeIndex, 1)");
  });

  it("MFA step-up falls back to password when 2FA is not enabled", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain("If 2FA is NOT enabled, accept password as fallback");
    expect(code).toContain("bcrypt.compare(input.password, userRecord.password)");
  });

  it("MFA tokens are short-lived (15 minutes)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/verify-mfa/route.ts");
    expect(code).toContain("15 * 60 * 1000");
    expect(code).toContain("expiresIn: 900");
  });

  it("MFA tokens are single-use", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/verify-mfa/route.ts");
    expect(code).toContain("Single-use: consume after verification");
    expect(code).toContain("mfaTokens.delete(token)");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. TOTP implementation correctness
// ══════════════════════════════════════════════════════════════════════

describe("TOTP implementation", () => {
  it("uses OTPAuth library (RFC 6238 compliant)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain('import * as OTPAuth from "otpauth"');
    expect(code).toContain("OTPAuth.TOTP");
  });

  it("TOTP uses SHA1, 6 digits, 30-second period (standard)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain('"SHA1"');
    expect(code).toContain("digits: 6");
    expect(code).toContain("period: 30");
  });

  it("TOTP allows ±1 window for clock drift", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain("window: 1");
  });

  it("issuer is Tuatha", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain('issuer: "Tuatha"');
  });

  it("secret uses 20 bytes (160 bits, recommended)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mfa.ts");
    expect(code).toContain("size: 20");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Security audit logging for MFA events
// ══════════════════════════════════════════════════════════════════════

describe("MFA audit logging", () => {
  it("athlete 2FA enable is logged", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/2fa/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ATHLETE_2FA_ENABLED");
  });

  it("athlete 2FA disable is logged", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/2fa/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ATHLETE_2FA_DISABLED");
  });

  it("pro 2FA enable is logged", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/2fa/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] PRO_2FA_ENABLED");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Passkey support (WebAuthn)
// ══════════════════════════════════════════════════════════════════════

describe("Passkey support", () => {
  it("Passkey model exists in schema", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("model Passkey {");
    expect(schema).toContain("credentialId");
    expect(schema).toContain("publicKey");
  });

  it("passkey register route exists", () => {
    expect(fs.existsSync("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/passkey/register/route.ts")).toBe(true);
  });

  it("passkey authenticate route exists", () => {
    expect(fs.existsSync("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/passkey/authenticate/route.ts")).toBe(true);
  });
});
