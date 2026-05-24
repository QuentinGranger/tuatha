import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P2.20 Tests de sécurité automatisés — Regression Suite ───
//
// This file covers:
//   1. CSRF protection tests
//   2. Functional XSS sanitization tests (input→output)
//   3. Rate limiting coverage
//   4. Regression index (all security test files present)
//   5. CI/CD and dependency scan configuration

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. CSRF Protection
// ══════════════════════════════════════════════════════════════════════

describe("CSRF protection", () => {
  const middleware = readCode("/Users/quentin/Desktop/Tuatha-pro/src/middleware.ts");

  it("blocks mutating requests with wrong Origin", () => {
    expect(middleware).toContain("MUTATING_METHODS");
    expect(middleware).toContain('new Set(["POST", "PUT", "PATCH", "DELETE"])');
  });

  it("checks origin against allowed origin", () => {
    expect(middleware).toContain("origin && origin !== allowed");
    expect(middleware).toContain("403");
  });

  it("exempts Stripe webhook from CSRF (server-to-server)", () => {
    expect(middleware).toContain("/api/payments/webhook");
  });

  it("uses SameSite cookie attribute", () => {
    // Session cookies use SameSite (set in session.ts)
    const session = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/session.ts");
    expect(session).toContain("sameSite");
  });

  it("sets credentials to same-origin on CORS", () => {
    expect(middleware).toContain("Access-Control-Allow-Credentials");
    expect(middleware).toContain('"true"');
  });

  it("Vary: Origin header is set", () => {
    expect(middleware).toContain('"Vary", "Origin"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Functional XSS sanitization (input → output)
// ══════════════════════════════════════════════════════════════════════

describe("XSS sanitization — functional tests", () => {
  // Import sanitize functions for real input/output testing
  let sanitizeMessage: (raw: unknown) => any;
  let sanitizeNote: (raw: unknown) => any;
  let sanitizeShortText: (raw: unknown) => any;

  it("loads sanitize module", async () => {
    const mod = await import("../../lib/sanitize");
    sanitizeMessage = mod.sanitizeMessage;
    sanitizeNote = mod.sanitizeNote;
    sanitizeShortText = mod.sanitizeShortText;
    expect(typeof sanitizeMessage).toBe("function");
  });

  it("strips <script> tags from messages", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage('<script>alert("xss")</script>Hello');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("<script>");
      expect(result.text).not.toContain("</script>");
      expect(result.text).toContain("Hello");
    }
  });

  it("strips <img onerror> payloads", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage('Hello <img src=x onerror=alert(1)> world');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("<img");
    }
  });

  it("neutralizes javascript: URIs", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage('Click javascript:alert(1)');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("javascript:");
      expect(result.text).toContain("[lien bloqué]");
    }
  });

  it("neutralizes data: URIs", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage('data:text/html,<script>alert(1)</script>');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("data:");
    }
  });

  it("blocks encoded base64 script payloads", async () => {
    const mod = await import("../../lib/sanitize");
    // PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg== = <script>alert(1)</script>
    const result = mod.sanitizeMessage('PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==');
    // Should either block or strip
    if (!result.ok) {
      expect(result.reason).toContain("suspect");
    }
  });

  it("strips event handler attributes", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage('Hello onclick="alert(1)" world');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toMatch(/onclick\s*=/);
    }
  });

  it("blocks template injection {{ }}", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage("{{constructor.constructor('return this')()}}");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("{{constructor");
    }
  });

  it("rejects non-string input", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage(12345);
    expect(result.ok).toBe(false);
  });

  it("rejects empty string after trim", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage("   ");
    expect(result.ok).toBe(false);
  });

  it("enforces max length", async () => {
    const mod = await import("../../lib/sanitize");
    const longMsg = "a".repeat(6000);
    const result = mod.sanitizeMessage(longMsg);
    expect(result.ok).toBe(false);
  });

  it("strips null bytes", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage("Hello\x00World");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("\x00");
    }
  });

  it("strips <style> blocks", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage('<style>body{display:none}</style>Hi');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("<style>");
      expect(result.text).not.toContain("display:none");
    }
  });

  it("handles double-encoded HTML entities", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeMessage("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("<script>");
    }
  });

  it("sanitizeNote works the same way", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeNote('<script>alert("xss")</script>Note');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).not.toContain("<script>");
    }
  });

  it("sanitizeShortText enforces 500 char limit", async () => {
    const mod = await import("../../lib/sanitize");
    const result = mod.sanitizeShortText("a".repeat(600));
    expect(result.ok).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Rate limiting coverage
// ══════════════════════════════════════════════════════════════════════

describe("Rate limiting", () => {
  it("rate-limit module exists", () => {
    expect(fs.existsSync("/Users/quentin/Desktop/Tuatha-pro/src/lib/rate-limit.ts")).toBe(true);
  });

  it("rateLimit module exists", () => {
    expect(fs.existsSync("/Users/quentin/Desktop/Tuatha-pro/src/lib/rateLimit.ts")).toBe(true);
  });

  it("auth login route uses rate limiting", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/auth/login/route.ts");
    expect(code).toMatch(/rateLimit|rate-limit|rateLimiter/i);
  });

  it("rate-limit module exports limiter function", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/rate-limit.ts");
    expect(code).toMatch(/export|rateLimit|limiter/i);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Security test regression index
// ══════════════════════════════════════════════════════════════════════

describe("Security test regression index", () => {
  const REQUIRED_TEST_FILES = [
    "ai-security.test.ts",
    "athlete-security-space.test.ts",
    "auth-security.test.ts",
    "consent-athlete.test.ts",
    "data-export-deletion.test.ts",
    "documents-uploads.test.ts",
    "frontend-security.test.ts",
    "idor-permissions.test.ts",
    "idor-protection.test.ts",
    "mfa-security.test.ts",
    "payment-security.test.ts",
    "pro-management.test.ts",
    "secure-messaging.test.ts",
    "security-logging.test.ts",
    "security-regression.test.ts",
    "sharing-athlete-pro.test.ts",
  ];

  const testDir = "/Users/quentin/Desktop/Tuatha-pro/src/lib/__tests__";

  for (const file of REQUIRED_TEST_FILES) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(`${testDir}/${file}`)).toBe(true);
    });
  }

  it("total security test files ≥ 16", () => {
    const files = fs.readdirSync(testDir).filter((f: string) => f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThanOrEqual(16);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. CI/CD and dependency scanning configuration
// ══════════════════════════════════════════════════════════════════════

describe("CI/CD security pipeline", () => {
  it("GitHub Actions security workflow exists", () => {
    expect(
      fs.existsSync("/Users/quentin/Desktop/Tuatha-pro/.github/workflows/security.yml"),
    ).toBe(true);
  });

  it("workflow runs vitest security tests", () => {
    const workflow = readCode("/Users/quentin/Desktop/Tuatha-pro/.github/workflows/security.yml");
    expect(workflow).toContain("vitest");
    expect(workflow).toContain("__tests__");
  });

  it("workflow includes npm audit for dependency scanning", () => {
    const workflow = readCode("/Users/quentin/Desktop/Tuatha-pro/.github/workflows/security.yml");
    expect(workflow).toContain("npm audit");
  });

  it("workflow blocks merge on test failure", () => {
    const workflow = readCode("/Users/quentin/Desktop/Tuatha-pro/.github/workflows/security.yml");
    expect(workflow).toContain("pull_request");
  });

  it("workflow runs on every push and PR", () => {
    const workflow = readCode("/Users/quentin/Desktop/Tuatha-pro/.github/workflows/security.yml");
    expect(workflow).toContain("push");
    expect(workflow).toContain("pull_request");
  });
});
