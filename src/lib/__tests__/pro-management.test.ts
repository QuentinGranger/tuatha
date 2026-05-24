import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P1.13 Gestion avancée des professionnels — Test Suite ───

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. Statut "pro vérifié"
// ══════════════════════════════════════════════════════════════════════

describe("Verified pro status", () => {
  it("my-pros returns verificationStatus and verifiedAt", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("verificationStatus");
    expect(code).toContain("verifiedAt");
    expect(code).toContain("isVerified");
  });

  it("Professionnel schema has verification fields", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const proModel = schema.slice(
      schema.indexOf("model Professionnel {"),
      schema.indexOf("model AthleteUser {"),
    );
    expect(proModel).toContain("verificationStatus");
    expect(proModel).toContain("verifiedAt");
    expect(proModel).toContain("verificationNote");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Spécialité visible
// ══════════════════════════════════════════════════════════════════════

describe("Speciality visible", () => {
  it("my-pros returns specialite and specialiteAffichee", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("specialite: pro.specialite");
    expect(code).toContain("specialiteAffichee");
    expect(code).toContain("professionAffichee");
  });

  it("my-connections also returns specialite", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-connections/route.ts");
    expect(code).toContain("specialite");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Numéro RPPS/ADELI/carte pro
// ══════════════════════════════════════════════════════════════════════

describe("RPPS/ADELI number visible", () => {
  it("my-pros returns numeroVerification for verified pros only", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("numeroVerification");
    // Only shown if verified
    expect(code).toContain('verificationStatus === "verified" ? pro.numeroVerification : null');
  });

  it("Professionnel schema has numeroVerification field", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("numeroVerification");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Historique du lien
// ══════════════════════════════════════════════════════════════════════

describe("Connection history", () => {
  it("my-pros returns full connection history (all statuses)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("athleteUserId: session.id");
    // No status filter = all history
    expect(code).not.toContain('status: "accepted"');
  });

  it("my-pros returns meta with counts", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("meta");
    expect(code).toContain("total:");
    expect(code).toContain("active:");
    expect(code).toContain("pending:");
    expect(code).toContain("revoked:");
    expect(code).toContain("expired:");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Date de début et fin d'accès
// ══════════════════════════════════════════════════════════════════════

describe("Access start and end dates", () => {
  it("my-pros returns dateDebutAcces and dateFinAcces", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("dateDebutAcces");
    expect(code).toContain("dateFinAcces");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Expiration automatique possible
// ══════════════════════════════════════════════════════════════════════

describe("Access expiration", () => {
  it("AthletePrivacySettings has expiresAt field", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const settingsModel = schema.slice(
      schema.indexOf("model AthletePrivacySettings {"),
      schema.indexOf("}", schema.indexOf("model AthletePrivacySettings {")) + 1,
    );
    expect(settingsModel).toContain("expiresAt");
    expect(settingsModel).toContain("DateTime?");
  });

  it("privacy PUT endpoint accepts expiresAt", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/privacy/[proId]/route.ts");
    expect(code).toContain("expiresAt");
    expect(code).toContain("new Date(body.expiresAt)");
  });

  it("my-pros checks for expiration", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("isExpired");
    expect(code).toContain('"expired"');
    expect(code).toContain("expiresAt");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Permissions modifiables sans supprimer le lien
// ══════════════════════════════════════════════════════════════════════

describe("Permissions editable without disconnecting", () => {
  it("privacy PUT endpoint uses upsert (update only)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/privacy/[proId]/route.ts");
    expect(code).toContain("export async function PUT");
    expect(code).toContain("athletePrivacySettings.upsert");
  });

  it("privacy PUT allows individual field updates", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/privacy/[proId]/route.ts");
    expect(code).toContain("ALLOWED_FIELDS");
    expect(code).toContain("shareSport");
    expect(code).toContain("shareAntecedents");
    expect(code).toContain("shareVitals");
  });

  it("my-pros indicates canEditPermissions", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("canEditPermissions");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Résumé clair "Ce pro peut voir…"
// ══════════════════════════════════════════════════════════════════════

describe("Clear permissions summary", () => {
  it("my-pros returns resumePermissions (human-readable list)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("resumePermissions");
    expect(code).toContain("buildPermissionSummary");
  });

  it("permission labels are in French", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("PERMISSION_LABELS");
    expect(code).toContain("Sport pratiqué");
    expect(code).toContain("Antécédents médicaux");
    expect(code).toContain("Traitements en cours");
    expect(code).toContain("Contre-indications");
    expect(code).toContain("Données de santé connectées");
    expect(code).toContain("Messagerie");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Différence claire entre spécialités
// ══════════════════════════════════════════════════════════════════════

describe("Clear speciality differentiation", () => {
  it("my-pros categorizes specialities", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("SPECIALITY_CATEGORIES");
    expect(code).toContain("categorizeSpeciality");
    expect(code).toContain("categorie");
  });

  it("categories cover main health professions", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("Kinésithérapeute");
    expect(code).toContain("Médecin du sport");
    expect(code).toContain("Nutritionniste");
    expect(code).toContain("Psychologue");
    expect(code).toContain("Coach sportif");
    expect(code).toContain("Ostéopathe");
    expect(code).toContain("Podologue");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Disconnect and connect infrastructure
// ══════════════════════════════════════════════════════════════════════

describe("Connect/disconnect infrastructure", () => {
  it("connect route verifies pro is verified and searchable", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/connect/route.ts");
    expect(code).toContain('verificationStatus !== "verified"');
    expect(code).toContain("searchable");
  });

  it("disconnect revokes connection + deletes privacy + logs consent", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts");
    expect(code).toContain('status: "rejected"');
    expect(code).toContain("athletePrivacySettings.deleteMany");
    expect(code).toContain("athleteConsent.create");
    expect(code).toContain('"pro_sharing"');
  });

  it("my-pros indicates canDisconnect", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/my-pros/route.ts");
    expect(code).toContain("canDisconnect");
  });
});
