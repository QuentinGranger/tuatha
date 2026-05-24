import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P1.14 Messagerie sécurisée — Test Suite ───

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. Conversation appartient à des participants précis (ACL)
// ══════════════════════════════════════════════════════════════════════

describe("Conversation ACL — participants only", () => {
  it("pro-to-pro messages require verifyConversationAccess", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/route.ts");
    expect(code).toContain("verifyConversationAccess");
    expect(code).toContain("if (!access.allowed)");
  });

  it("conversationAccess checks shared ProConnection", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/conversationAccess.ts");
    expect(code).toContain('status: "connecte"');
    expect(code).toContain("sharedAthleteIds");
  });

  it("athlete messages scoped to athleteUserId + professionnelId", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/[proId]/route.ts");
    expect(code).toContain("athleteUserId: session.id");
    expect(code).toContain("professionnelId: proId");
  });

  it("athlete messages require accepted connection", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/[proId]/route.ts");
    expect(code).toContain('status: "accepted"');
    expect(code).toContain("Non connecté à ce professionnel");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Aucun pro externe ne peut lire la conversation
// ══════════════════════════════════════════════════════════════════════

describe("No external pro can read conversation", () => {
  it("GET messages checks sender/receiver match or membership", () => {
    const msgRoute = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/route.ts");
    expect(msgRoute).toContain("senderProId: session.id");
    expect(msgRoute).toContain("receiverProId: proId");
  });

  it("group messages check membership before access", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/route.ts");
    expect(code).toContain("proConversationMember.findUnique");
    expect(code).toContain("Non membre de cette conversation");
  });

  it("conversations list only shows connected pros", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/messagerie/conversations/route.ts");
    expect(code).toContain("getConnectedProIds");
    expect(code).toContain("connectedIds.has(key)");
  });

  it("PATCH/DELETE message checks sender/receiver ownership", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/[id]/route.ts");
    expect(code).toContain("msg.senderProId !== session.id && msg.receiverProId !== session.id");
    expect(code).toContain('"Non autorisé"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Pièces jointes suivent les mêmes règles que les documents
// ══════════════════════════════════════════════════════════════════════

describe("Attachments follow document security rules", () => {
  it("upload checks conversation access", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/upload/route.ts");
    expect(code).toContain("verifyConversationAccess");
    expect(code).toContain("if (!access.allowed)");
  });

  it("upload scans files for security", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/upload/route.ts");
    expect(code).toContain("scanUploadedFile");
    expect(code).toContain("if (!scan.safe)");
  });

  it("upload enforces max file count", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/upload/route.ts");
    expect(code).toContain("MAX_FILES");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Notifications ne contiennent pas le message complet
// ══════════════════════════════════════════════════════════════════════

describe("Notifications do not expose full message content", () => {
  it("notification previews are truncated (max 80 chars)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/notifications/route.ts");
    // Check that previews are sliced
    expect(code).toContain('preview: g.lastMsg.content?.slice(0, 80) || ""');
  });

  it("notification subtitles are truncated (max 50 chars)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/notifications/route.ts");
    expect(code).toContain("g.lastMsg.content?.slice(0, 50)");
  });

  it("push notifications use generic body, not message content", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/route.ts");
    // Push body should be generic, not finalContent
    const pushMatches = code.match(/body: "Nouveau message"/g);
    expect(pushMatches).not.toBeNull();
    expect(pushMatches!.length).toBeGreaterThanOrEqual(2);
    // Ensure old finalContent.slice pattern is gone
    expect(code).not.toContain("body: finalContent");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. L'athlète peut signaler un message
// ══════════════════════════════════════════════════════════════════════

describe("Athlete can report a message", () => {
  it("report endpoint exists and is authenticated", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/report/route.ts");
    expect(code).toContain("export async function POST");
    expect(code).toContain("getSessionAthlete");
  });

  it("report validates message belongs to athlete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/report/route.ts");
    expect(code).toContain("athleteUserId: session.id");
    expect(code).toContain("Message introuvable");
  });

  it("report has standard reason types", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/report/route.ts");
    expect(code).toContain('"inappropriate"');
    expect(code).toContain('"harassment"');
    expect(code).toContain('"spam"');
    expect(code).toContain('"privacy_violation"');
  });

  it("report is audit-logged", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/report/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ATHLETE_MESSAGE_REPORT");
    expect(code).toContain("athleteAccessLog.create");
    expect(code).toContain('"message_report"');
  });

  it("report is rate-limited", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/report/route.ts");
    expect(code).toContain("rateLimit");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. L'athlète peut bloquer un pro
// ══════════════════════════════════════════════════════════════════════

describe("Athlete can block a pro", () => {
  it("block-pro POST endpoint exists", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/block-pro/route.ts");
    expect(code).toContain("export async function POST");
    expect(code).toContain("getSessionAthlete");
  });

  it("blocking revokes active connection", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/block-pro/route.ts");
    expect(code).toContain('status: "rejected"');
    expect(code).toContain("athletePrivacySettings.deleteMany");
  });

  it("blocking rejects pending requests too", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/block-pro/route.ts");
    expect(code).toContain('status: "pending"');
  });

  it("blocking creates AthleteBlockedPro record", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/block-pro/route.ts");
    expect(code).toContain("athleteBlockedPro.create");
  });

  it("blocking logs consent revocation", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/block-pro/route.ts");
    expect(code).toContain("athleteConsent.create");
    expect(code).toContain('"pro_blocked"');
  });

  it("block is audit-logged", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/block-pro/route.ts");
    expect(code).toContain("[SECURITY-AUDIT] ATHLETE_BLOCK_PRO");
    expect(code).toContain("athleteAccessLog.create");
    expect(code).toContain('"block_pro"');
  });

  it("unblock (DELETE) is supported", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/block-pro/route.ts");
    expect(code).toContain("export async function DELETE");
    expect(code).toContain("athleteBlockedPro.deleteMany");
  });

  it("AthleteBlockedPro model exists in schema", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("model AthleteBlockedPro");
    expect(schema).toContain("@@unique([athleteUserId, professionnelId])");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Suppression ou archivage défini
// ══════════════════════════════════════════════════════════════════════

describe("Message deletion/archival defined", () => {
  it("message deletion uses softDelete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/[id]/route.ts");
    expect(code).toContain("softDelete");
    expect(code).toContain('"proMessage"');
  });

  it("deletion is audit-logged with full content snapshot", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/[id]/route.ts");
    expect(code).toContain("audit.logDelete");
    expect(code).toContain("content: msg.content");
    expect(code).toContain("senderProId: msg.senderProId");
    expect(code).toContain("receiverProId: msg.receiverProId");
  });

  it("group message queries exclude deleted messages", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/route.ts");
    expect(code).toContain("deletedAt: null");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Pas de données santé dans les logs de messagerie
// ══════════════════════════════════════════════════════════════════════

describe("No health data in messaging logs", () => {
  it("audit logs for messages only store content and metadata, not health data", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/[id]/route.ts");
    // Audit log stores content, sender/receiver, athlete link, dates — no health fields
    expect(code).toContain("content: msg.content");
    expect(code).not.toContain("healthData");
    expect(code).not.toContain("medical");
    expect(code).not.toContain("diagnosis");
    expect(code).not.toContain("vital");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Protection anti-spam
// ══════════════════════════════════════════════════════════════════════

describe("Anti-spam protection", () => {
  it("athlete message POST is rate-limited", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/[proId]/route.ts");
    expect(code).toContain("rateLimit");
    expect(code).toContain("RATE_LIMITS.write");
  });

  it("athlete message GET is rate-limited", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/[proId]/route.ts");
    expect(code).toContain("RATE_LIMITS.read");
  });

  it("pro message POST sanitizes content", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/reseau/messages/route.ts");
    expect(code).toContain("sanitizeMessage");
  });

  it("athlete message POST sanitizes body", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/messages/[proId]/route.ts");
    expect(code).toContain("sanitizeBody");
  });

  it("pro connect route has per-user rate limit", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/connect/route.ts");
    expect(code).toContain("applyRateLimit");
    expect(code).toContain("connect:user:");
  });
});
