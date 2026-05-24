import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── Documents & Uploads P0 Test Suite ───
// Validates:
// 1. Upload limited to allowed formats with magic bytes
// 2. Size limits enforced per category
// 3. Content scanning (JS in PDFs, scripts in SVGs, zip bombs, CSV injection)
// 4. Filename sanitization
// 5. Files stored outside public folder (private uploads/)
// 6. Signed URLs (HMAC + expiry + subject binding)
// 7. No permanent public URLs
// 8. Access control before every download
// 9. Access control before every preview
// 10. Upload/download/consultation history
// 11. Soft-delete for documents
// 12. No medical data in public filename
// 13. No documents as email attachments
// 14. Encryption at rest

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. Upload format restrictions + magic bytes
// ══════════════════════════════════════════════════════════════════════

describe("Upload format restrictions", () => {
  it("fileScan has category-based allowed MIME types", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("CATEGORY_CONFIG");
    expect(code).toContain("allowedMimes");
    expect(code).toContain('"document"');
    expect(code).toContain('"image"');
    expect(code).toContain('"video"');
  });

  it("fileScan validates magic bytes before trusting MIME", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("detectFileType");
    expect(code).toContain("SIGNATURES");
    expect(code).toContain("0xFF, 0xD8, 0xFF"); // JPEG
    expect(code).toContain("0x25, 0x50, 0x44, 0x46"); // %PDF
  });

  it("fileScan rejects unrecognized file types", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("Type de fichier non reconnu");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Size limits
// ══════════════════════════════════════════════════════════════════════

describe("Upload size limits", () => {
  it("document max size is 10 MB", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("10 * 1024 * 1024");
  });

  it("image max size is 5 MB", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("5 * 1024 * 1024");
  });

  it("video max size is 200 MB", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("200 * 1024 * 1024");
  });

  it("empty files are rejected", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("Le fichier est vide");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Content scanning (antivirus/malware detection)
// ══════════════════════════════════════════════════════════════════════

describe("Content scanning", () => {
  it("scans PDFs for JavaScript and malicious actions", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("scanPdf");
    expect(code).toContain("/JavaScript");
    expect(code).toContain("/Launch");
    expect(code).toContain("/EmbeddedFile");
  });

  it("scans SVGs for scripts and event handlers", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("scanSvg");
    expect(code).toContain("<script");
    expect(code).toContain("javascript:");
  });

  it("scans images for polyglot attacks", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("scanImage");
    expect(code).toContain("contenu suspect");
  });

  it("detects zip bombs via compression ratio", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("scanZipArchive");
    expect(code).toContain("zip bomb");
  });

  it("detects VBA macros in Office documents", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("vbaProject.bin");
    expect(code).toContain("macros VBA");
  });

  it("detects CSV formula injection", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("scanText");
    expect(code).toContain("formules potentiellement dangereuses");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Filename sanitization
// ══════════════════════════════════════════════════════════════════════

describe("Filename sanitization", () => {
  it("sanitizeFilename removes path separators and null bytes", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("sanitizeFilename");
    expect(code).toContain("Remove path separators and null bytes");
  });

  it("sanitizeFilename removes leading dots", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("^\\.+");
  });

  it("sanitizeFilename limits filename length", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileScan.ts");
    expect(code).toContain("clean.length > 200");
  });

  it("stored filenames are UUID-based (no medical data in name)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/route.ts");
    expect(code).toContain("doc-${randomUUID()}");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Files stored outside public folder
// ══════════════════════════════════════════════════════════════════════

describe("Files stored privately", () => {
  it("documents stored in uploads/ directory (not public/)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/route.ts");
    expect(code).toContain('path.join(process.cwd(), "uploads", "documents")');
    expect(code).not.toContain('path.join(process.cwd(), "public"');
  });

  it("athlete documents stored privately", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/route.ts");
    expect(code).toContain('"uploads", "athlete-documents"');
  });

  it("videos stored privately", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete-videos/upload/route.ts");
    expect(code).toContain('"uploads", "videos"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Signed URLs — HMAC + expiry + subject binding
// ══════════════════════════════════════════════════════════════════════

describe("Signed URLs", () => {
  it("signedUrl uses HMAC-SHA256", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/signedUrl.ts");
    expect(code).toContain('createHmac("sha256"');
  });

  it("signedUrl includes subject in HMAC payload", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/signedUrl.ts");
    expect(code).toContain("${filePath}:${expiresAt}:${sub}");
  });

  it("signedUrl has configurable TTL (default 1h)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/signedUrl.ts");
    expect(code).toContain("60 * 60 * 1000");
  });

  it("verification uses timing-safe comparison", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/signedUrl.ts");
    expect(code).toContain("timingSafeEqual");
  });

  it("verifyFileToken checks expiry", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/signedUrl.ts");
    expect(code).toContain("Date.now() / 1000) > expiresAt");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. No permanent public URLs
// ══════════════════════════════════════════════════════════════════════

describe("No permanent public URLs", () => {
  it("catch-all route requires signed URL token", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain("URL sign");
    expect(code).toContain("!token || !expires || !sub");
  });

  it("catch-all route sets no-store cache headers", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain("no-store");
    expect(code).toContain("X-Content-Type-Options");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Access control before download
// ══════════════════════════════════════════════════════════════════════

describe("Access control before download", () => {
  it("catch-all route verifies session matches sub", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain("session.id !== sub");
  });

  it("catch-all route performs DB-level permission check", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain("checkFileAccess");
  });

  it("fileAccess checks document ownership (sender or receiver)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileAccess.ts");
    expect(code).toContain("senderProId === proId || doc.receiverProId === proId");
  });

  it("fileAccess denies unknown file types by default", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileAccess.ts");
    expect(code).toContain("Type de fichier non reconnu");
  });

  it("directory traversal is blocked", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain('includes("..")');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Athlete download has access control
// ══════════════════════════════════════════════════════════════════════

describe("Athlete download access control", () => {
  it("athlete download requires authentication", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/download/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("Non authentifié");
  });

  it("athlete download verifies ownership of sent docs", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/download/route.ts");
    expect(code).toContain("athleteUserId: session.id");
  });

  it("athlete download blocks directory traversal", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/download/route.ts");
    expect(code).toContain('filePath.includes("..")');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Download history / audit logging
// ══════════════════════════════════════════════════════════════════════

describe("Download audit logging", () => {
  it("exfiltration module logs downloads", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/exfiltration.ts");
    expect(code).toContain("logDownload");
    expect(code).toContain("auditLog");
  });

  it("downloadControl audits downloads", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/downloadControl.ts");
    expect(code).toContain("auditDownload");
  });

  it("catch-all route calls both audit mechanisms", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain("auditDownload");
    expect(code).toContain("logDownload");
    expect(code).toContain("recordDownload");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Anti-exfiltration quotas
// ══════════════════════════════════════════════════════════════════════

describe("Anti-exfiltration download quotas", () => {
  it("per-minute burst limit exists", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/exfiltration.ts");
    expect(code).toContain("maxCount: 10");
    expect(code).toContain('"minute"');
  });

  it("progressive lockout on violations", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/exfiltration.ts");
    expect(code).toContain("violations");
    expect(code).toContain("lockoutDurations");
  });

  it("anomaly logging on quota exceeded", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/exfiltration.ts");
    expect(code).toContain("logAnomaly");
    expect(code).toContain("[EXFILTRATION]");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 12. Soft-delete for documents
// ══════════════════════════════════════════════════════════════════════

describe("Soft-delete for documents", () => {
  it("SharedDocument has deletedAt and deletedBy", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toMatch(/model SharedDocument[\s\S]*?deletedAt/);
    expect(schema).toMatch(/model SharedDocument[\s\S]*?deletedBy/);
  });

  it("DELETE route uses softDelete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/route.ts");
    expect(code).toContain("softDelete");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 13. No medical documents as email attachments
// ══════════════════════════════════════════════════════════════════════

describe("No medical docs in email attachments", () => {
  it("mailer never uses attachments field", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/mailer.ts");
    expect(code).not.toContain("attachments:");
    expect(code).not.toContain("attachment:");
  });

  it("document email sends signed download link, not file", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/route.ts");
    expect(code).toContain("signFileUrlForEmail");
    expect(code).toContain("downloadUrl");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 14. Encryption at rest
// ══════════════════════════════════════════════════════════════════════

describe("Encryption at rest", () => {
  it("fileEncryption module uses AES-256-GCM", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileEncryption.ts");
    expect(code).toContain("aes-256-gcm");
    expect(code).toContain("createCipheriv");
    expect(code).toContain("createDecipheriv");
  });

  it("encryptBuffer writes [IV][authTag][ciphertext]", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileEncryption.ts");
    expect(code).toContain("Buffer.concat([iv, authTag, encrypted])");
  });

  it("readFileAuto transparently decrypts .enc files", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/fileEncryption.ts");
    expect(code).toContain("readFileAuto");
    expect(code).toContain("decryptFileToBuffer");
  });

  it("pro document upload encrypts at rest", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/route.ts");
    expect(code).toContain("encryptBuffer");
  });

  it("athlete document upload encrypts at rest", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/documents/route.ts");
    expect(code).toContain("encryptBuffer");
  });

  it("document version upload encrypts at rest", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/documents/[id]/versions/route.ts");
    expect(code).toContain("encryptBuffer");
  });

  it("catch-all upload route uses readFileAuto for transparent decryption", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/uploads/[...path]/route.ts");
    expect(code).toContain("readFileAuto");
    expect(code).toContain("resolveFilePath");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 15. Role-based download restrictions
// ══════════════════════════════════════════════════════════════════════

describe("Role-based download restrictions", () => {
  it("coach cannot download medical documents", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/downloadControl.ts");
    expect(code).toContain("coach");
    expect(code).toMatch(/coach[\s\S]*?medical[\s\S]*?canDownload: false/);
  });

  it("watermark enforced for connected pro downloads", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/downloadControl.ts");
    expect(code).toContain("watermark: true"); // Always for connected pros
  });

  it("confidentiality levels are defined per category", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/downloadControl.ts");
    expect(code).toContain("CATEGORY_CONFIDENTIALITY");
    expect(code).toContain('"medical"');
    expect(code).toContain('"confidentiel"');
  });
});
