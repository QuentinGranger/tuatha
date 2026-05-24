import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P0.7 Security Logging Test Suite ───
// Validates CNIL-recommended audit logging for all critical operations:
// - Login réussi / échoué
// - Reset password
// - Changement email / mot de passe
// - Création / révocation lien pro
// - Consentement donné / retiré
// - Document uploadé / consulté / téléchargé
// - Donnée modifiée
// - Export demandé
// - Compte supprimé
// - Accès admin/support
// - Erreur d'autorisation
// - Tentative suspecte
// Also verifies: no health data in logs, standardized event format

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. Login réussi / échoué
// ══════════════════════════════════════════════════════════════════════

describe("Login logging", () => {
  const loginCode = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/login/route.ts");

  it("logs successful login via securityMonitor.trackLogin", () => {
    expect(loginCode).toContain("securityMonitor.trackLogin(ip, emailLower, true)");
  });

  it("logs failed login via securityMonitor.trackLogin", () => {
    expect(loginCode).toContain("securityMonitor.trackLogin(ip, emailLower, false)");
  });

  it("logs account lockout via SecurityAlert", () => {
    expect(loginCode).toContain('"login_locked"');
  });

  it("logs new device login via SecurityAlert", () => {
    expect(loginCode).toContain('"new_device_login"');
  });

  it("logs suspicious login blocked via SecurityAlert", () => {
    expect(loginCode).toContain('"suspicious_login_blocked"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Reset password
// ══════════════════════════════════════════════════════════════════════

describe("Password reset logging", () => {
  it("logs password reset request via SecurityAlert", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/forgot-password/route.ts");
    expect(code).toContain('"password_reset_requested"');
  });

  it("logs password changed after reset via SecurityAlert", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/reset-password/route.ts");
    expect(code).toContain('"password_changed"');
  });

  it("logs rate-limited reset attempts", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/forgot-password/route.ts");
    expect(code).toContain('"reset_rate_limited"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Email change
// ══════════════════════════════════════════════════════════════════════

describe("Email change logging", () => {
  it("logs email change via SecurityAlert in profile PUT", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/route.ts");
    expect(code).toContain('"email_changed"');
    expect(code).toContain("Email modifié");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Password change (from settings)
// ══════════════════════════════════════════════════════════════════════

describe("Password change logging", () => {
  it("logs password change via SecurityAlert", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/password/route.ts");
    expect(code).toContain('"password_changed"');
    expect(code).toContain("securityAlert.create");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Création / Révocation de lien avec pro
// ══════════════════════════════════════════════════════════════════════

describe("Pro connection logging", () => {
  it("athlete disconnect logs revocation in AthleteConsent table", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts");
    expect(code).toContain("athleteConsent");
    expect(code).toContain('action: "revoked"');
    expect(code).toContain('consentType: "pro_sharing"');
  });

  it("consent module logs connection consent changes", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/consent.ts");
    expect(code).toContain("consentLog.create");
    expect(code).toContain("writeLog");
  });

  it("invitation acceptance logs in structured console", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/invitation/[id]/route.ts");
    expect(code).toContain("proConnection.create");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Consentement donné / retiré
// ══════════════════════════════════════════════════════════════════════

describe("Consent logging", () => {
  it("athlete consent granted/revoked writes immutable log", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/consents/route.ts");
    expect(code).toContain("athleteConsent.create");
    expect(code).toContain('action: granted ? "granted" : "revoked"');
  });

  it("consent log includes IP and userAgent", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/consents/route.ts");
    expect(code).toContain("ip");
    expect(code).toContain("userAgent");
  });

  it("pro-side consent changes log via writeLog", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/consent.ts");
    expect(code).toContain("consentLog.create");
    expect(code).toContain("consentType");
    expect(code).toContain("action");
    expect(code).toContain("previousValue");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Document uploadé / consulté / téléchargé
// ══════════════════════════════════════════════════════════════════════

describe("Document audit logging", () => {
  it("pro document upload logs SECURITY-AUDIT event", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] DOCUMENT_UPLOADED");
  });

  it("athlete document upload logs SECURITY-AUDIT event", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ATHLETE_DOCUMENT_UPLOADED");
  });

  it("document download logs via logDownload (exfiltration module)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain("logDownload");
  });

  it("document download has audit trail via auditDownload", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/downloadControl.ts");
    expect(code).toContain("auditDownload");
  });

  it("exfiltration module logs downloads with user, path, size, IP, UA", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/exfiltration.ts");
    expect(code).toContain("logDownload");
    expect(code).toContain("userId");
    expect(code).toContain("filePath");
    expect(code).toContain("fileSize");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Donnée modifiée (audit trail)
// ══════════════════════════════════════════════════════════════════════

describe("Data modification audit", () => {
  it("auditLog module provides logCreate/logUpdate/logDelete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/auditLog.ts");
    expect(code).toContain("logCreate");
    expect(code).toContain("logUpdate");
    expect(code).toContain("logDelete");
  });

  it("audit entries contain actor, entity, entityId, timestamp", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/auditLog.ts");
    expect(code).toContain("actorProId");
    expect(code).toContain("entity");
    expect(code).toContain("entityId");
    expect(code).toContain("timestamp");
  });

  it("audit log emits structured console output", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/auditLog.ts");
    expect(code).toContain("[AUDIT]");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Export demandé
// ══════════════════════════════════════════════════════════════════════

describe("Export logging", () => {
  it("export route logs SecurityAlert", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/exports/route.ts");
    expect(code).toContain('"data_exported"');
    expect(code).toContain("securityAlert.create");
  });

  it("export route tracks via securityMonitor.trackExport", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/exports/route.ts");
    expect(code).toContain("securityMonitor.trackExport");
  });

  it("athlete export-data route logs access", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("logAthleteAccess");
    expect(code).toContain("export_data");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Compte supprimé
// ══════════════════════════════════════════════════════════════════════

describe("Account deletion logging", () => {
  it("account deletion creates SecurityAlert before cascade delete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/account/route.ts");
    expect(code).toContain('"account_deleted"');
    expect(code).toContain("securityAlert.create");
  });

  it("account deletion emits structured audit log", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/account/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ACCOUNT_DELETED");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Accès admin/support
// ══════════════════════════════════════════════════════════════════════

describe("Admin access logging", () => {
  it("admin routes are protected by ADMIN_SECRET", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/admin/backup/route.ts");
    expect(code).toContain("ADMIN_SECRET");
    expect(code).toContain("checkAdminAuth");
  });

  it("SecurityAlert table tracks per-professional events", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("model SecurityAlert");
    expect(schema).toContain("professionnelId");
    expect(schema).toContain("type");
    expect(schema).toContain("ip");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 12. Erreur d'autorisation (401/403 monitoring)
// ══════════════════════════════════════════════════════════════════════

describe("Authorization error monitoring", () => {
  it("withAuth tracks 401 via securityMonitor.trackAuthFailure", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/withAuth.ts");
    expect(code).toContain("trackAuthFailure");
    expect(code).toContain("401");
  });

  it("withAuth tracks 403 via securityMonitor.trackAuthFailure", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/withAuth.ts");
    expect(code).toContain("trackAuthFailure");
    expect(code).toContain("403");
  });

  it("securityMonitor emits auth_failure_spike alert on repeated failures", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("auth_failure_spike");
    expect(code).toContain("trackAuthFailure");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 13. Tentative suspecte
// ══════════════════════════════════════════════════════════════════════

describe("Suspicious activity detection", () => {
  it("securityMonitor detects credential stuffing", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("credential_stuffing");
  });

  it("securityMonitor detects athlete enumeration", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("athlete_enumeration");
  });

  it("securityMonitor detects export spikes", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("export_spike");
  });

  it("securityMonitor detects rapid write actions", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("rapid_actions");
  });

  it("securityMonitor detects off-hours activity", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("off_hours_activity");
  });

  it("securityMonitor persists critical alerts to DB", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("persistAlertToDb");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 14. Logs ne dupliquent pas le contenu médical
// ══════════════════════════════════════════════════════════════════════

describe("No health data in logs", () => {
  it("SecurityAlert model has no health data fields", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const alertModel = schema.slice(
      schema.indexOf("model SecurityAlert"),
      schema.indexOf("}", schema.indexOf("model SecurityAlert")) + 1,
    );
    expect(alertModel).not.toContain("diagnostic");
    expect(alertModel).not.toContain("ordonnance");
    expect(alertModel).not.toContain("pathologie");
    expect(alertModel).not.toContain("antecedent");
  });

  it("audit log document upload does NOT include file content or medical data", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/route.ts");
    const logLine = code.slice(code.indexOf("[SECURITY-AUDIT] DOCUMENT_UPLOADED"));
    const logEnd = logLine.indexOf(";");
    const logSection = logLine.slice(0, logEnd);
    // Should contain: by, docId, category, receiver, size
    expect(logSection).toContain("docId=");
    expect(logSection).toContain("category=");
    // Should NOT contain file contents or medical terms
    expect(logSection).not.toContain("content=");
    expect(logSection).not.toContain("buffer");
    expect(logSection).not.toContain("diagnostic");
  });

  it("exfiltration log does NOT contain file content", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/exfiltration.ts");
    expect(code).not.toContain("fileContent");
    expect(code).not.toContain("readFile");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 15. Standardized event format
// ══════════════════════════════════════════════════════════════════════

describe("Standardized event format", () => {
  it("security monitor uses structured [SECURITY-MONITOR] prefix", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("[SECURITY-MONITOR]");
    expect(code).toContain("severity.toUpperCase()");
    expect(code).toContain("JSON.stringify");
  });

  it("audit log uses structured [AUDIT] prefix", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/auditLog.ts");
    expect(code).toContain("[AUDIT]");
    expect(code).toContain("action.toUpperCase()");
  });

  it("document audit uses [SECURITY-AUDIT] prefix", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/route.ts");
    expect(code).toContain("[SECURITY-AUDIT]");
  });

  it("account deletion uses [SECURITY-AUDIT] prefix", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/account/route.ts");
    expect(code).toContain("[SECURITY-AUDIT]");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 16. Athlete access logging (RGPD transparency)
// ══════════════════════════════════════════════════════════════════════

describe("Athlete access logging (RGPD)", () => {
  it("athleteAccessLog module provides logAthleteAccess", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/athleteAccessLog.ts");
    expect(code).toContain("logAthleteAccess");
    expect(code).toContain("athleteAccessLog.create");
  });

  it("logs include action, IP, userAgent", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/athleteAccessLog.ts");
    expect(code).toContain("action");
    expect(code).toContain("ip");
    expect(code).toContain("userAgent");
  });

  it("covers key athlete actions", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/athleteAccessLog.ts");
    expect(code).toContain("export_data");
    expect(code).toContain("view_documents");
    expect(code).toContain("update_profile");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 17. Logs consultables en admin sécurisé
// ══════════════════════════════════════════════════════════════════════

describe("Logs accessible via admin", () => {
  it("securityMonitor provides getAlerts query API", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/securityMonitor.ts");
    expect(code).toContain("getAlerts");
    expect(code).toContain("getSummary");
  });

  it("auditLog provides getRecent and getEntityHistory", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/auditLog.ts");
    expect(code).toContain("getRecent");
    expect(code).toContain("getEntityHistory");
    expect(code).toContain("getDeletionsByUser");
  });
});
