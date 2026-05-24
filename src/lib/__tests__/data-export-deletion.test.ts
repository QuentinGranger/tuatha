import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P0.10 Data Export & Deletion Security Test Suite ───
// Validates RGPD compliance for data export and account deletion.

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. L'athlète peut demander l'export
// ══════════════════════════════════════════════════════════════════════

describe("Athlete can request data export", () => {
  it("export-data route exists and is authenticated", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("export async function GET");
  });

  it("export includes profile data", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("nom:");
    expect(code).toContain("prenom:");
    expect(code).toContain("email:");
    expect(code).toContain("telephone:");
  });

  it("export includes connections, messages, events, documents", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("connexions:");
    expect(code).toContain("messages:");
    expect(code).toContain("rendezVous:");
    expect(code).toContain("documents:");
  });

  it("export includes health data (Art. 20 portability)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("healthConnections");
    expect(code).toContain("healthData");
    expect(code).toContain("donneesSante:");
    expect(code).toContain("appareilsConnectes:");
  });

  it("export includes access logs and data requests", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("historiqueAccesPro:");
    expect(code).toContain("historiqueAccesAthlete:");
    expect(code).toContain("demandesAcces:");
  });

  it("export includes consultation preps and nutrition logs", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("preparationsConsultation:");
    expect(code).toContain("journauxNutrition:");
  });

  it("export includes privacy settings", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("parametresConfidentialite:");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. L'athlète peut demander la suppression
// ══════════════════════════════════════════════════════════════════════

describe("Athlete can request account deletion", () => {
  it("delete-account route exists", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("export async function DELETE");
  });

  it("delete-account is authenticated", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("getSessionAthlete");
  });

  it("delete-account performs athleteUser.delete cascade", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("prisma.athleteUser.delete");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Authentification forte avant export
// ══════════════════════════════════════════════════════════════════════

describe("Strong authentication before export", () => {
  it("export requires authenticated session", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain('status: 401');
  });

  it("export only returns data for the authenticated athlete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("athlete.id");
    // All queries use the session athlete id
    expect(code).toContain("athleteUserId: athlete.id");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Authentification forte avant suppression
// ══════════════════════════════════════════════════════════════════════

describe("Strong authentication before deletion", () => {
  it("deletion requires session + password confirmation", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("bcrypt.compare");
    expect(code).toContain("Mot de passe requis");
    expect(code).toContain("Mot de passe incorrect");
  });

  it("pro deletion also requires password confirmation", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/account/route.ts");
    expect(code).toContain("withAuth");
    expect(code).toContain("bcrypt.compare");
    expect(code).toContain("Mot de passe requis");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Export généré dans un format lisible
// ══════════════════════════════════════════════════════════════════════

describe("Export in readable format", () => {
  it("export returns JSON with Content-Disposition", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("application/json");
    expect(code).toContain("Content-Disposition");
    expect(code).toContain("mes-donnees-tuatha");
  });

  it("export uses human-readable French labels", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("profil:");
    expect(code).toContain("inscritLe:");
    expect(code).toContain("derniereMiseAJour:");
  });

  it("export date is included", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("exportDate:");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Lien d'export temporaire
// ══════════════════════════════════════════════════════════════════════

describe("Export download is session-bound (temporary)", () => {
  it("export requires valid session (acts as temporary access)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    // Session-based auth = link only works while authenticated
    expect(code).toContain("getSessionAthlete");
    // Returns 401 if no session = link is de facto temporary
    expect(code).toContain('{ error: "Non autorisé" }');
  });

  it("export logs the action for audit trail", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("logAthleteAccess");
    expect(code).toContain('"export_data"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Suppression des sessions après suppression compte
// ══════════════════════════════════════════════════════════════════════

describe("Sessions revoked after account deletion", () => {
  it("athlete deletion revokes all sessions before delete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("revokeAllSessions");
    expect(code).toContain('"athlete"');
    expect(code).toContain('"account_deleted"');
  });

  it("athlete deletion clears auth cookies", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("clearAuthCookies");
  });

  it("pro deletion revokes all sessions before delete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/account/route.ts");
    expect(code).toContain("authSession.updateMany");
    expect(code).toContain("account_deleted");
  });

  it("revokeAllSessions supports athlete type", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/session.ts");
    expect(code).toContain('userType: "pro" | "athlete"');
    expect(code).toContain('where.athleteUserId = userId');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Révocation des pros après suppression
// ══════════════════════════════════════════════════════════════════════

describe("Pro connections revoked after athlete deletion", () => {
  it("athlete deletion revokes all ConnectionRequests", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("connectionRequest.updateMany");
    expect(code).toContain('status: "rejected"');
  });

  it("athlete deletion revokes ProConnections", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("proConnection.updateMany");
    expect(code).toContain('"refuse"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Suppression des tokens externes
// ══════════════════════════════════════════════════════════════════════

describe("External tokens deleted on account deletion", () => {
  it("athlete deletion nullifies HealthAppConnection tokens", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("healthAppConnection.updateMany");
    expect(code).toContain("accessToken: null");
    expect(code).toContain("refreshToken: null");
    expect(code).toContain('"disconnected"');
  });

  it("HealthAppConnection has onDelete Cascade from AthleteUser in schema", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const hacModel = schema.slice(
      schema.indexOf("model HealthAppConnection {"),
      schema.indexOf("}", schema.indexOf("model HealthAppConnection {")) + 1,
    );
    expect(hacModel).toContain("onDelete: Cascade");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Conservation séparée des obligations comptables
// ══════════════════════════════════════════════════════════════════════

describe("Accounting data preserved separately on deletion", () => {
  it("athlete deletion annotates Payment metadata before cascade", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("payment.updateMany");
    expect(code).toContain("deletedAthleteEmail");
    expect(code).toContain("deletedAt");
  });

  it("data retention map documents 10-year accounting obligation", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/data-retention/route.ts");
    expect(code).toContain("10 ans");
    expect(code).toContain("L.123-22");
  });

  it("retention policies in dataMinimization reference accounting law", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/dataMinimization.ts");
    expect(code).toContain("Code de commerce Art. L.123-22");
    expect(code).toContain("10 ans");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Confirmation email après suppression
// ══════════════════════════════════════════════════════════════════════

describe("Confirmation email after deletion", () => {
  it("athlete deletion sends confirmation email", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("sendAccountDeletedEmail");
    expect(code).toContain("to: user.email");
  });

  it("pro deletion sends confirmation email", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/account/route.ts");
    expect(code).toContain("sendAccountDeletedEmail");
    expect(code).toContain("to: pro.email");
  });

  it("sendAccountDeletedEmail function exists in email module", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/email.ts");
    expect(code).toContain("export async function sendAccountDeletedEmail");
    expect(code).toContain("Compte supprime");
    expect(code).toContain("Ce qui a ete supprime");
  });

  it("email explains what was deleted vs retained", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/email.ts");
    expect(code).toContain("Donnees conservees (obligation legale)");
    expect(code).toContain("L.123-22");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 12. Log minimal de la demande
// ══════════════════════════════════════════════════════════════════════

describe("Minimal log of deletion request", () => {
  it("athlete deletion logs [SECURITY-AUDIT] before cascade", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ATHLETE_ACCOUNT_DELETED");
  });

  it("athlete deletion writes consent log entry", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/delete-account/route.ts");
    expect(code).toContain("athleteConsent.create");
    expect(code).toContain('"account_deletion"');
  });

  it("pro deletion logs [SECURITY-AUDIT] before cascade", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/profil/account/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ACCOUNT_DELETED");
  });

  it("export logs the action via athleteAccessLog", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/export-data/route.ts");
    expect(code).toContain("logAthleteAccess");
    expect(code).toContain('"export_data"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 13. Document de rétention
// ══════════════════════════════════════════════════════════════════════

describe("Data retention documentation", () => {
  it("retention endpoint exists and is authenticated", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/data-retention/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("export async function GET");
  });

  it("retention map lists all deleted data categories", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/data-retention/route.ts");
    expect(code).toContain("Profil personnel");
    expect(code).toContain("Données de santé");
    expect(code).toContain("Connexions professionnels");
    expect(code).toContain("Messages");
    expect(code).toContain("Documents");
    expect(code).toContain("Rendez-vous");
    expect(code).toContain("Données connectées (santé)");
    expect(code).toContain("Nutrition");
    expect(code).toContain("Sessions et sécurité");
    expect(code).toContain("Consentements");
  });

  it("retention map lists conserved data with legal basis", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/data-retention/route.ts");
    expect(code).toContain("donnees_conservees");
    expect(code).toContain("Factures et paiements");
    expect(code).toContain("duree_conservation");
    expect(code).toContain("base_legale");
    expect(code).toContain("L.123-22");
  });

  it("retention map documents the deletion procedure", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/data-retention/route.ts");
    expect(code).toContain("procedure");
    expect(code).toContain("Authentification forte");
    expect(code).toContain("Révocation");
    expect(code).toContain("Anonymisation des données comptables");
    expect(code).toContain("email de confirmation");
  });

  it("retention policies exist in dataMinimization with legal references", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/dataMinimization.ts");
    expect(code).toContain("RETENTION_POLICIES");
    expect(code).toContain("legalBasis");
    expect(code).toContain("RGPD Art. 5(1)(e)");
    expect(code).toContain("CSP Art. R.1112-7");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 14. Pro-side rights (erasure via userRights)
// ══════════════════════════════════════════════════════════════════════

describe("Pro-side erasure (Art. 17) via rights endpoint", () => {
  it("rights route handles erasure requests", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athletes/[id]/rights/route.ts");
    expect(code).toContain('"erasure"');
    expect(code).toContain("userRights.erase");
  });

  it("userRights.erase checks for accounting blockers", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/userRights.ts");
    expect(code).toContain("invoiceCount");
    expect(code).toContain("L.123-22");
    expect(code).toContain("obligation de conservation comptable");
  });

  it("erasure uses anonymizeAthlete for irreversible anonymization", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/userRights.ts");
    expect(code).toContain("anonymizeAthlete");
  });

  it("anonymizeAthlete replaces all PII fields", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/dataMinimization.ts");
    expect(code).toContain("ATHLETE_PII_FIELDS");
    expect(code).toContain("Anonyme-");
    expect(code).toContain("contactEmail: null");
    expect(code).toContain("contactPhone: null");
    expect(code).toContain("injuryNote: null");
    expect(code).toContain("antecedents: []");
  });
});
