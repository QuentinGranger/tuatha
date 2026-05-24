import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P1.12 Espace sécurité visible par l'athlète — Test Suite ───

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. Page "Sécurité" — API endpoints
// ══════════════════════════════════════════════════════════════════════

describe("Security page API exists and is authenticated", () => {
  it("GET /api/athlete/security exists", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("export async function GET");
    expect(code).toContain("getSessionAthlete");
  });

  it("security endpoint supports filter parameter", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain('filter');
    expect(code).toContain('"sessions"');
    expect(code).toContain('"pros"');
    expect(code).toContain('"documents"');
    expect(code).toContain('"consents"');
    expect(code).toContain('"exports"');
    expect(code).toContain('"integrations"');
  });

  it("security endpoint includes MFA status", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("mfaEnabled");
    expect(code).toContain("twoFactorEnabled");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Dernières connexions
// ══════════════════════════════════════════════════════════════════════

describe("Recent connections visible", () => {
  it("security endpoint returns login history", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("loginHistory");
    expect(code).toContain("authSession.findMany");
  });

  it("login history includes device, IP, dates, revocation status", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("deviceName: true");
    expect(code).toContain("ip: true");
    expect(code).toContain("revoked: true");
    expect(code).toContain("revokedReason: true");
    expect(code).toContain("lastActiveAt: true");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Appareils connectés
// ══════════════════════════════════════════════════════════════════════

describe("Connected devices visible", () => {
  it("sessions endpoint lists active sessions with device info", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/sessions/route.ts");
    expect(code).toContain("export async function GET");
    expect(code).toContain("deviceName: true");
    expect(code).toContain("userAgent: true");
  });

  it("sessions indicate which is current", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/sessions/route.ts");
    expect(code).toContain("isCurrent");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Bouton "déconnecter tous les appareils"
// ══════════════════════════════════════════════════════════════════════

describe("Disconnect all devices button", () => {
  it("sessions DELETE endpoint supports all=true", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/sessions/route.ts");
    expect(code).toContain("export async function DELETE");
    expect(code).toContain("if (all)");
    expect(code).toContain("revokeAllSessions");
    expect(code).toContain('"user_revoke_all"');
  });

  it("sessions DELETE supports revoking specific session", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/sessions/route.ts");
    expect(code).toContain("if (sessionId)");
    expect(code).toContain('"user_revoke"');
  });

  it("sessions DELETE prevents revoking current session", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/sessions/route.ts");
    expect(code).toContain("Utilisez /api/auth/logout pour la session courante");
  });

  it("revoke all is audit-logged", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/sessions/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ATHLETE_REVOKE_ALL_SESSIONS");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Historique des professionnels connectés
// ══════════════════════════════════════════════════════════════════════

describe("Pro connection history visible", () => {
  it("security endpoint returns proConnections", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("proConnections");
    expect(code).toContain("connectionRequest.findMany");
  });

  it("proConnections include status, dates, and pro identity", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("status: c.status");
    expect(code).toContain("nom: c.professionnel.nom");
    expect(code).toContain("specialite: c.professionnel.specialite");
  });

  it("security endpoint returns pro access logs", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("proAccessLogs");
    expect(code).toContain("proAccessLog.findMany");
  });

  it("sharing-history route also provides full audit trail", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/sharing-history/route.ts");
    expect(code).toContain("connectionRequest.findMany");
    expect(code).toContain("proAccessLog.findMany");
    expect(code).toContain("athleteConsent.findMany");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Historique des documents consultés
// ══════════════════════════════════════════════════════════════════════

describe("Document access history visible", () => {
  it("security endpoint returns documentActivity", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("documentActivity");
    expect(code).toContain("view_documents");
    expect(code).toContain("delete_document");
  });

  it("security endpoint returns pro document access logs", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("proDocumentAccess");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Historique des consentements
// ══════════════════════════════════════════════════════════════════════

describe("Consent history visible", () => {
  it("security endpoint returns consentHistory", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("consentHistory");
    expect(code).toContain("athleteConsent.findMany");
  });

  it("consent history includes type, action, granted, date", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("consentType: true");
    expect(code).toContain("action: true");
    expect(code).toContain("granted: true");
    expect(code).toContain("documentVersion: true");
  });

  it("consents endpoint also provides status + history", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/consents/route.ts");
    expect(code).toContain("status");
    expect(code).toContain("history");
    expect(code).toContain("athleteConsent.findMany");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Historique des exports
// ══════════════════════════════════════════════════════════════════════

describe("Export history visible", () => {
  it("security endpoint returns exportHistory", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("exportHistory");
    expect(code).toContain('"export_data"');
  });

  it("export action is logged via athleteAccessLog", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("logAthleteAccess");
    expect(code).toContain('"export_data"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Historique des intégrations externes
// ══════════════════════════════════════════════════════════════════════

describe("External integrations history visible", () => {
  it("security endpoint returns integrations (HealthAppConnections)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("integrations");
    expect(code).toContain("healthAppConnection.findMany");
    expect(code).toContain("provider: true");
    expect(code).toContain("status: true");
    expect(code).toContain("lastSyncAt: true");
  });

  it("security endpoint returns integration activity logs", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/route.ts");
    expect(code).toContain("integrationActivity");
    expect(code).toContain("connect_wearable");
    expect(code).toContain("disconnect_wearable");
    expect(code).toContain("sync_health_data");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Signalement activité suspecte
// ══════════════════════════════════════════════════════════════════════

describe("Suspicious activity reporting", () => {
  it("report endpoint exists and is authenticated", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/report/route.ts");
    expect(code).toContain("export async function POST");
    expect(code).toContain("getSessionAthlete");
  });

  it("report accepts standard report types", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/report/route.ts");
    expect(code).toContain('"unknown_session"');
    expect(code).toContain('"unauthorized_access"');
    expect(code).toContain('"unknown_device"');
    expect(code).toContain('"data_breach_suspicion"');
  });

  it("report requires description (min 10 chars)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/report/route.ts");
    expect(code).toContain("description.length < 10");
  });

  it("report auto-revokes suspicious session when type is unknown_session", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/report/route.ts");
    expect(code).toContain('"suspicious_report"');
    expect(code).toContain("relatedSessionId");
  });

  it("report is audit-logged", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/security/report/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ATHLETE_SUSPICIOUS_REPORT");
    expect(code).toContain("athleteAccessLog.create");
    expect(code).toContain('"security_report"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Access log infrastructure
// ══════════════════════════════════════════════════════════════════════

describe("Athlete access log infrastructure", () => {
  it("AthleteAccessLog model exists in schema", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("model AthleteAccessLog");
    expect(schema).toContain("athleteUserId");
    expect(schema).toContain("action");
    expect(schema).toContain("resource");
  });

  it("logAthleteAccess utility covers all action types", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/athleteAccessLog.ts");
    expect(code).toContain("view_profile");
    expect(code).toContain("view_documents");
    expect(code).toContain("export_data");
    expect(code).toContain("connect_wearable");
    expect(code).toContain("disconnect_wearable");
    expect(code).toContain("sync_health_data");
  });
});
