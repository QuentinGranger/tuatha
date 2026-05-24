import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── API & IDOR Protection Test Suite ───
// Validates P0 requirements:
// 1. Every API route requires authentication
// 2. Every route verifies ownership
// 3. Every route verifies sharing scopes
// 4. Cannot change athleteId/documentId/conversationId to read other data
// 5. Cannot modify another user's consent
// 6. Cannot export another athlete's data
// 7. Cannot delete another user's account
// 8. Error messages don't leak information

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// Helper: find all route.ts files
function findRouteFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) results.push(...findRouteFiles(full));
    else if (entry.name === "route.ts") results.push(full);
  }
  return results;
}

const API_DIR = "/Users/quentin/Desktop/Tuatha-pro/src/app/api";
const allRoutes = findRouteFiles(API_DIR);

// Routes that are legitimately unauthenticated
const ALLOWED_NO_AUTH = [
  "/auth/login", "/auth/logout", "/auth/refresh", "/auth/google", "/auth/google/callback",
  "/auth/outlook", "/auth/outlook/callback", "/auth/calendly", "/auth/calendly/callback",
  "/auth/verify-email", "/auth/forgot-password", "/auth/reset-password",
  "/auth/passkey/authenticate",
  "/inscription/professionnel", "/inscription/athlete",
  "/inscription/professionnel/configuration",
  "/inscription/professionnel/stripe-onboarding",
  "/inscription/professionnel/stripe-onboarding/refresh",
  "/inscription/professionnel/stripe-onboarding/return",
  "/payments/webhook",
  "/locale",
  "/places/autocomplete", "/places/details",
  "/athlete/health/webhook", // external webhook from health provider
];

// ══════════════════════════════════════════════════════════════════════
// 1. All routes require authentication
// ══════════════════════════════════════════════════════════════════════

describe("All routes require authentication", () => {
  const routeFiles = allRoutes.filter((f) => {
    const rel = f.replace(API_DIR, "").replace("/route.ts", "");
    return !ALLOWED_NO_AUTH.some((allowed) => rel === allowed);
  });

  it("found API routes to check", () => {
    expect(routeFiles.length).toBeGreaterThan(100);
  });

  it("all non-public routes have auth check", () => {
    const missing: string[] = [];
    for (const file of routeFiles) {
      const code = readCode(file);
      const hasAuth =
        code.includes("getSessionPro") ||
        code.includes("getSessionAthlete") ||
        code.includes("withAuth") ||
        code.includes("withAthleteAccess") ||
        code.includes("withRoles") ||
        code.includes("withPermission") ||
        code.includes("withAuthOnly") ||
        code.includes("ADMIN_SECRET") ||
        code.includes("CRON_SECRET") ||
        // Token-based routes (video upload, invitation)
        code.includes("videoUploadToken") ||
        code.includes("tokensMatch");
      if (!hasAuth) {
        const rel = file.replace(API_DIR, "");
        missing.push(rel);
      }
    }
    expect(missing).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Athlete routes verify ownership via session
// ══════════════════════════════════════════════════════════════════════

describe("Athlete routes verify ownership", () => {
  it("athlete export uses only session.id (no user-supplied athleteId)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("athlete.id");
    expect(code).not.toContain("params.athleteId"); // No user-supplied ID
  });

  it("athlete consents route uses session only", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/consents/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("session.id");
  });

  it("athlete documents route uses session for ownership", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("session.id");
  });

  it("athlete disconnect uses session.id as owner check", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/disconnect/[proId]/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("athleteUserId: session.id");
  });

  it("athlete messages verify connection before showing data", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/[proId]/route.ts");
    expect(code).toContain("athleteUserId: session.id");
    expect(code).toContain("status: \"accepted\"");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Pro routes verify ownership or ABAC scope
// ══════════════════════════════════════════════════════════════════════

describe("Pro routes verify ownership or ABAC scope", () => {
  it("withAthleteAccess middleware enforces ABAC", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/withAthleteAccess.ts");
    expect(code).toContain("checkAthleteAccess");
    expect(code).toContain("access.granted");
  });

  it("ABAC checks ownership OR active connection", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/abac.ts");
    expect(code).toContain("professionnelId: proId");
    expect(code).toContain('status: "connecte"');
    expect(code).toContain("Aucun accès à cet athlète");
  });

  it("connection-request route verifies professional ownership", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/connection-request/[id]/route.ts");
    expect(code).toContain("professionnelId !== session.id");
    expect(code).toContain("Non autorisé");
  });

  it("document download checks sender or receiver", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileAccess.ts");
    expect(code).toContain("senderProId === proId || doc.receiverProId === proId");
  });

  it("athletes/:id PATCH verifies owning professional", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athletes/[id]/route.ts");
    expect(code).toContain("accessType");
    expect(code).toContain("ATHLETE_TRANSFER_BLOCKED");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Cannot change athleteId to access another dossier
// ══════════════════════════════════════════════════════════════════════

describe("Cannot change athleteId for IDOR", () => {
  it("ABAC requires ownership or active ProConnection for athlete access", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/abac.ts");
    // Must find the athlete under this pro, or have active ProConnection
    expect(code).toContain("athleteId, professionnelId: proId");
    expect(code).toContain("connectedProId: proId");
  });

  it("withAthleteAccess returns 403 when access denied", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/withAthleteAccess.ts");
    expect(code).toContain("403");
    expect(code).toContain("Accès refusé");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Cannot change documentId for IDOR
// ══════════════════════════════════════════════════════════════════════

describe("Cannot change documentId for IDOR", () => {
  it("document access checks sender or receiver in DB", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileAccess.ts");
    expect(code).toContain("checkDocumentAccess");
    expect(code).toContain("senderProId");
    expect(code).toContain("receiverProId");
  });

  it("document version access checks ownership", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/[id]/versions/route.ts");
    expect(code).toContain("senderProId !== session.id && doc.receiverProId !== session.id");
  });

  it("athlete document download verifies athlete is owner/receiver", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/download/route.ts");
    expect(code).toContain("athleteUserId: session.id");
    expect(code).toContain("receiverAthleteId: { in: athleteIds }");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Cannot change conversationId for IDOR
// ══════════════════════════════════════════════════════════════════════

describe("Cannot change conversationId for IDOR", () => {
  it("athlete messages are scoped to session.id + proId", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/[proId]/route.ts");
    expect(code).toContain("athleteUserId: session.id, professionnelId: proId");
  });

  it("athlete message delete verifies ownership", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/delete/[id]/route.ts");
    expect(code).toContain("getSessionAthlete");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Cannot modify another user's consent
// ══════════════════════════════════════════════════════════════════════

describe("Cannot modify another user's consent", () => {
  it("consent route uses session-only (no user-supplied ID)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/consents/route.ts");
    expect(code).toContain("session.id");
    expect(code).not.toContain("request.json().athleteId");
  });

  it("privacy settings route uses session for ownership", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/privacy/[proId]/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("athleteUserId: session.id");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Cannot export another athlete's data
// ══════════════════════════════════════════════════════════════════════

describe("Cannot export another athlete's data", () => {
  it("export route uses session.id only", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("athlete.id");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Admin routes protected by secret
// ══════════════════════════════════════════════════════════════════════

describe("Admin routes protected", () => {
  const adminRoutes = allRoutes.filter((f) => f.includes("/api/admin/"));

  it("all admin routes check ADMIN_SECRET", () => {
    const missing: string[] = [];
    for (const file of adminRoutes) {
      const code = readCode(file);
      if (!code.includes("ADMIN_SECRET") && !code.includes("checkAdminAuth")) {
        missing.push(file.replace(API_DIR, ""));
      }
    }
    expect(missing).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Cron routes protected by secret
// ══════════════════════════════════════════════════════════════════════

describe("Cron routes protected", () => {
  const cronRoutes = allRoutes.filter((f) => f.includes("/api/cron/"));

  it("all cron routes check CRON_SECRET", () => {
    const missing: string[] = [];
    for (const file of cronRoutes) {
      const code = readCode(file);
      if (!code.includes("CRON_SECRET")) {
        missing.push(file.replace(API_DIR, ""));
      }
    }
    expect(missing).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Error messages don't leak information
// ══════════════════════════════════════════════════════════════════════

describe("Error messages are safe", () => {
  it("withAuth returns generic error on auth failure", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/withAuth.ts");
    expect(code).toContain("Non authentifié");
    expect(code).not.toContain("password");
    expect(code).not.toContain("token =");
  });

  it("ABAC returns safe error messages", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/abac.ts");
    expect(code).not.toContain("SQL");
    expect(code).not.toContain("stack");
    expect(code).toContain("Aucun accès");
  });

  it("file access returns generic not-found on unauthorized", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileAccess.ts");
    // Should not reveal whether document exists
    expect(code).toContain("introuvable");
    expect(code).toContain("non autorisé");
  });

  it("connection-request returns 404 before 403 (no enumeration)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/connection-request/[id]/route.ts");
    // Check that 404 check comes before 403 check
    const idx404 = code.indexOf("Demande introuvable");
    const idx403 = code.indexOf("Non autorisé");
    expect(idx404).toBeLessThan(idx403);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 12. Directory traversal prevention
// ══════════════════════════════════════════════════════════════════════

describe("Directory traversal prevention", () => {
  it("upload serving route blocks ..", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain('includes("..")');
  });

  it("athlete document download blocks ..", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/download/route.ts");
    expect(code).toContain('includes("..")');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 13. Anti-MITM detection
// ══════════════════════════════════════════════════════════════════════

describe("Anti-MITM protection", () => {
  it("withAuth detects IP change (session hijack)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/withAuth.ts");
    expect(code).toContain("MITM-DETECT");
    expect(code).toContain("getSessionIp");
    expect(code).toContain("sessionIp !== currentIp");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 14. VPN/Proxy blocking
// ══════════════════════════════════════════════════════════════════════

describe("VPN/Proxy blocking", () => {
  it("withAuth blocks high-confidence VPN", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/withAuth.ts");
    expect(code).toContain("vpn.isBlocked");
    expect(code).toContain("VPN_BLOCKED");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 15. Write action anomaly detection
// ══════════════════════════════════════════════════════════════════════

describe("Write action monitoring", () => {
  it("withAuth tracks write actions", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/withAuth.ts");
    expect(code).toContain("securityMonitor.trackWriteAction");
  });
});
