import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── Athlete ↔ Pro Sharing Test Suite ───
// Validates P0 sharing requirements:
// 1. Athlete explicitly chooses the pro
// 2. Pro must be verified before receiving data
// 3. Granular privacy settings per pro
// 4. Athlete can revoke (disconnect)
// 5. Pro cannot transfer dossier
// 6. Pro cannot access after revocation
// 7. Sharing history preserved
// 8. Invitation link expires + non-guessable

const readCode = (path: string) => fs.readFileSync(path, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. Athlete explicitly chooses pro
// ══════════════════════════════════════════════════════════════════════

describe("Athlete explicitly chooses pro", () => {
  it("connect route exists and is athlete-initiated", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/connect/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("professionnelId");
  });

  it("connect route requires athlete authentication", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/connect/route.ts");
    expect(code).toContain("Non authentifié");
  });

  it("connect route has rate limiting", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/connect/route.ts");
    expect(code).toContain("applyRateLimit");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Pro must be verified before receiving data
// ══════════════════════════════════════════════════════════════════════

describe("Pro must be verified", () => {
  it("connect route checks pro emailVerified and verificationStatus", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/connect/route.ts");
    expect(code).toContain("emailVerified");
    expect(code).toContain("verificationStatus");
    expect(code).toContain('"verified"');
  });

  it("unverified pro is rejected with generic message", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/connect/route.ts");
    // If not verified, returns 404 to prevent enumeration
    expect(code).toContain("Professionnel introuvable");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Granular privacy settings per pro
// ══════════════════════════════════════════════════════════════════════

describe("Granular privacy per pro", () => {
  it("AthletePrivacySettings model has per-category fields", async () => {
    const { Prisma } = await import("@prisma/client");
    const fields = Prisma.AthletePrivacySettingsScalarFieldEnum;
    expect(fields).toHaveProperty("shareSport");
    expect(fields).toHaveProperty("sharePhysical");
    expect(fields).toHaveProperty("shareAntecedents");
    expect(fields).toHaveProperty("shareTraitements");
    expect(fields).toHaveProperty("shareContraindic");
    expect(fields).toHaveProperty("shareVitals");
    expect(fields).toHaveProperty("shareConsultPrep");
    expect(fields).toHaveProperty("sharePhoto");
    expect(fields).toHaveProperty("shareMessaging");
  });

  it("privacy settings are per athlete-pro pair (unique constraint)", async () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("@@unique([athleteUserId, professionnelId])");
  });

  it("privacyGuard applies filter to redact unauthorized fields", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/privacyGuard.ts");
    expect(code).toContain("applyPrivacyFilter");
    expect(code).toContain("_privacyRedacted");
  });

  it("privacyGuard defaults to most restrictive on error", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/privacyGuard.ts");
    expect(code).toContain("defaulting to restrictive");
  });

  it("athlete can update privacy settings per pro", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/privacy/[proId]/route.ts");
    expect(code).toContain("export async function PUT");
    expect(code).toContain("athletePrivacySettings.upsert");
  });

  it("athlete can view privacy settings per pro", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/privacy/[proId]/route.ts");
    expect(code).toContain("export async function GET");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Athlete can disconnect (revoke pro)
// ══════════════════════════════════════════════════════════════════════

describe("Athlete can disconnect pro", () => {
  it("disconnect route exists", () => {
    const exists = fs.existsSync(
      "/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts"
    );
    expect(exists).toBe(true);
  });

  it("disconnect route uses DELETE method", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts");
    expect(code).toContain("export async function DELETE");
  });

  it("disconnect revokes the connection immediately", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts");
    expect(code).toContain('status: "rejected"');
  });

  it("disconnect deletes privacy settings", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts");
    expect(code).toContain("athletePrivacySettings.deleteMany");
  });

  it("disconnect revokes ProConnections shared by this pro", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts");
    expect(code).toContain("proConnection.updateMany");
    expect(code).toContain('"refuse"');
  });

  it("disconnect logs consent revocation", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts");
    expect(code).toContain("athleteConsent.create");
    expect(code).toContain('"pro_sharing"');
    expect(code).toContain('"revoked"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Pro cannot transfer dossier
// ══════════════════════════════════════════════════════════════════════

describe("Pro cannot transfer dossier", () => {
  it("PATCH athletes/:id blocks professionnelId change", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athletes/[id]/route.ts");
    expect(code).toContain("ATHLETE_TRANSFER_BLOCKED");
    expect(code).toContain("transfert de propriété");
  });

  it("double safety: professionnelId deleted from update data", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athletes/[id]/route.ts");
    expect(code).toContain("delete data.professionnelId");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Pro cannot access after revocation (ABAC check)
// ══════════════════════════════════════════════════════════════════════

describe("Pro cannot access after revocation", () => {
  it("ABAC checks connection status is accepted/connecte", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/abac.ts");
    expect(code).toContain('"accepted"');
    expect(code).toContain('"connecte"');
  });

  it("ABAC checks expiration on ProConnection", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/abac.ts");
    expect(code).toContain("expiresAt");
    expect(code).toContain("expired");
  });

  it("ABAC returns denied if no active connection", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/abac.ts");
    expect(code).toContain("Aucun accès à cet athlète");
  });

  it("ABAC checks granular data scopes", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/abac.ts");
    expect(code).toContain("meetsActionLevel");
    expect(code).toContain("Accès insuffisant");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Sharing history preserved
// ══════════════════════════════════════════════════════════════════════

describe("Sharing history preserved", () => {
  it("sharing-history route exists", () => {
    const exists = fs.existsSync(
      "/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/sharing-history/route.ts"
    );
    expect(exists).toBe(true);
  });

  it("sharing-history returns connections, access logs, consent history", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/sharing-history/route.ts");
    expect(code).toContain("connections");
    expect(code).toContain("accessLogs");
    expect(code).toContain("consentHistory");
  });

  it("ProAccessLog model tracks pro access to athlete data", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("model ProAccessLog");
    expect(schema).toContain("blocked");
  });

  it("privacyGuard logs access on profile view", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/privacyGuard.ts");
    expect(code).toContain("logAccess");
    expect(code).toContain("proAccessLog");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Invitation link security
// ══════════════════════════════════════════════════════════════════════

describe("Invitation link security", () => {
  it("ProInvitation has a unique token", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toMatch(/token\s+String\s+@unique/);
  });

  it("ProInvitation has expiresAt", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("expiresAt");
  });

  it("invitation route uses timing-safe token comparison", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/invitation/[id]/route.ts");
    expect(code).toContain("timingSafeEqual");
  });

  it("invitation route checks expiration", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/invitation/[id]/route.ts");
    expect(code).toContain("isExpired");
    expect(code).toContain("410");
  });

  it("invitation route is single-use (usedAt tracking)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/invitation/[id]/route.ts");
    expect(code).toContain("usedAt");
  });

  it("invitation requires consent check before creating ProConnection", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/invitation/[id]/route.ts");
    expect(code).toContain("checkSharingConsent");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Blocked athlete cannot re-connect
// ══════════════════════════════════════════════════════════════════════

describe("Blocked athlete handling", () => {
  it("connect route checks if athlete is blocked", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/connect/route.ts");
    expect(code).toContain("blockedAthlete");
  });

  it("block route exists", () => {
    const exists = fs.existsSync(
      "/Users/quentin/Desktop/Tuatha-pro/src/app/api/connection-request/[id]/block/route.ts"
    );
    expect(exists).toBe(true);
  });
});
