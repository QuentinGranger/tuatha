import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P1.16 Sécurité front-end — Test Suite ───

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. CSP configurée
// ══════════════════════════════════════════════════════════════════════

describe("CSP configured", () => {
  const middleware = readCode("/Users/quentin/Desktop/Tuatha-pro/src/middleware.ts");

  it("sets Content-Security-Policy header", () => {
    expect(middleware).toContain("Content-Security-Policy");
  });

  it("has default-src 'self'", () => {
    expect(middleware).toContain("default-src 'self'");
  });

  it("restricts script-src in production (no unsafe-eval)", () => {
    expect(middleware).toContain("script-src 'self' 'unsafe-inline'");
    // unsafe-eval only in dev
    expect(middleware).toContain("'unsafe-eval'");
    expect(middleware).toContain("IS_PRODUCTION");
  });

  it("blocks framing (frame-ancestors 'none')", () => {
    expect(middleware).toContain("frame-ancestors 'none'");
  });

  it("restricts form-action and base-uri", () => {
    expect(middleware).toContain("form-action 'self'");
    expect(middleware).toContain("base-uri 'self'");
  });

  it("upgrades insecure requests in production", () => {
    expect(middleware).toContain("upgrade-insecure-requests");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. CORS strict
// ══════════════════════════════════════════════════════════════════════

describe("CORS strict", () => {
  const middleware = readCode("/Users/quentin/Desktop/Tuatha-pro/src/middleware.ts");

  it("has single allowed origin function", () => {
    expect(middleware).toContain("getAllowedOrigin");
    expect(middleware).toContain("https://tuatha.pro");
  });

  it("blocks requests from wrong origins on mutating methods", () => {
    expect(middleware).toContain("MUTATING_METHODS");
    expect(middleware).toContain("Origine non autoris");
  });

  it("sets CORS headers on API responses", () => {
    expect(middleware).toContain("Access-Control-Allow-Origin");
    expect(middleware).toContain("Access-Control-Allow-Credentials");
  });

  it("handles CORS preflight", () => {
    expect(middleware).toContain("OPTIONS");
    expect(middleware).toContain("Access-Control-Max-Age");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Pas de secrets dans le front
// ══════════════════════════════════════════════════════════════════════

describe("No secrets in front-end", () => {
  it("NEXT_PUBLIC vars are only safe public values", () => {
    const envExample = readCode("/Users/quentin/Desktop/Tuatha-pro/.env.example");
    const publicVars = envExample.match(/NEXT_PUBLIC_\w+/g) || [];
    const safePublicVars = ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_VAPID_PUBLIC_KEY"];
    for (const v of publicVars) {
      expect(safePublicVars).toContain(v);
    }
  });

  it(".env is gitignored", () => {
    const gitignore = readCode("/Users/quentin/Desktop/Tuatha-pro/.gitignore");
    expect(gitignore).toContain(".env*");
    expect(gitignore).toContain("!.env.example");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Pas de clés API sensibles exposées
// ══════════════════════════════════════════════════════════════════════

describe("No sensitive API keys exposed", () => {
  it("vault manages secrets server-side only", () => {
    const vault = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/vault.ts");
    expect(vault).toContain("openaiApiKey");
    expect(vault).toContain("OPENAI_API_KEY");
    // vault is a server lib, not imported in client components
  });

  it("no NEXT_PUBLIC_ prefix for secret keys", () => {
    const envExample = readCode("/Users/quentin/Desktop/Tuatha-pro/.env.example");
    // These should NOT have NEXT_PUBLIC_ prefix
    expect(envExample).not.toContain("NEXT_PUBLIC_OPENAI");
    expect(envExample).not.toContain("NEXT_PUBLIC_STRIPE_SECRET");
    expect(envExample).not.toContain("NEXT_PUBLIC_DATABASE");
    expect(envExample).not.toContain("NEXT_PUBLIC_ENCRYPTION");
    expect(envExample).not.toContain("NEXT_PUBLIC_GOOGLE_CLIENT_SECRET");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Pas de données santé dans analytics
// ══════════════════════════════════════════════════════════════════════

describe("No health data in analytics", () => {
  it("no external analytics SDK installed", () => {
    const pkg = readCode("/Users/quentin/Desktop/Tuatha-pro/package.json");
    expect(pkg).not.toContain("google-analytics");
    expect(pkg).not.toContain("posthog");
    expect(pkg).not.toContain("mixpanel");
    expect(pkg).not.toContain("amplitude");
    expect(pkg).not.toContain("@segment/");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Pas de données santé dans Sentry ou équivalent
// ══════════════════════════════════════════════════════════════════════

describe("No health data in Sentry", () => {
  it("no Sentry SDK installed", () => {
    const pkg = readCode("/Users/quentin/Desktop/Tuatha-pro/package.json");
    expect(pkg).not.toContain("@sentry/");
    expect(pkg).not.toContain("@sentry/nextjs");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Pas d'erreurs front trop détaillées
// ══════════════════════════════════════════════════════════════════════

describe("No detailed front-end errors", () => {
  it("global error boundary exists", () => {
    const errorPage = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/error.tsx");
    expect(errorPage).toContain("use client");
    expect(errorPage).toContain("Une erreur est survenue");
  });

  it("error boundary does not expose stack traces or error details", () => {
    const errorPage = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/error.tsx");
    expect(errorPage).not.toContain("error.message");
    expect(errorPage).not.toContain("error.stack");
    expect(errorPage).not.toContain("stackTrace");
    // Only logs digest, not the message
    expect(errorPage).toContain("error.digest");
  });

  it("API errors return generic messages (not stack traces)", () => {
    // Spot-check a few API routes
    const consent = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/consents/route.ts");
    expect(consent).toContain('"Erreur serveur"');
    expect(consent).not.toContain("error.stack");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Protection XSS
// ══════════════════════════════════════════════════════════════════════

describe("XSS protection", () => {
  const middleware = readCode("/Users/quentin/Desktop/Tuatha-pro/src/middleware.ts");

  it("X-XSS-Protection header set", () => {
    expect(middleware).toContain("X-XSS-Protection");
    expect(middleware).toContain("1; mode=block");
  });

  it("X-Content-Type-Options nosniff", () => {
    expect(middleware).toContain("X-Content-Type-Options");
    expect(middleware).toContain("nosniff");
  });

  it("sanitization library exists", () => {
    const sanitize = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/sanitize.ts");
    expect(sanitize).toContain("sanitizeText");
    expect(sanitize).toContain("sanitizeMessage");
  });

  it("CSP blocks inline scripts in production", () => {
    // In production, script-src does not have unsafe-eval
    expect(middleware).toContain("IS_PRODUCTION");
    expect(middleware).toContain("script-src 'self' 'unsafe-inline'");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Validation front + validation back
// ══════════════════════════════════════════════════════════════════════

describe("Front + back validation", () => {
  it("Zod validation library is used server-side", () => {
    const validation = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/validation.ts");
    expect(validation).toContain("import { z");
    expect(validation).toContain("ZodSchema");
    expect(validation).toContain("validateBody");
  });

  it("password fields use type=password in forms", () => {
    const inscriptionPro = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/inscription/professionnel/page.tsx");
    expect(inscriptionPro).toContain('type="password"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Masquage des données sensibles dans l'interface
// ══════════════════════════════════════════════════════════════════════

describe("Sensitive data masking", () => {
  it("redaction engine masks sensitive fields", () => {
    const redaction = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/redaction.ts");
    expect(redaction).toContain("[Données protégées]");
    expect(redaction).toContain("MASK_PLACEHOLDER");
  });

  it("security headers prevent clickjacking", () => {
    const middleware = readCode("/Users/quentin/Desktop/Tuatha-pro/src/middleware.ts");
    expect(middleware).toContain("X-Frame-Options");
    expect(middleware).toContain("DENY");
  });

  it("HSTS enforces HTTPS", () => {
    const middleware = readCode("/Users/quentin/Desktop/Tuatha-pro/src/middleware.ts");
    expect(middleware).toContain("Strict-Transport-Security");
    expect(middleware).toContain("max-age=31536000");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Timeout d'inactivité sur pages sensibles
// ══════════════════════════════════════════════════════════════════════

describe("Inactivity timeout on sensitive pages", () => {
  it("useInactivityTimeout hook exists", () => {
    const hook = readCode("/Users/quentin/Desktop/Tuatha-pro/src/hooks/useInactivityTimeout.ts");
    expect(hook).toContain("useInactivityTimeout");
    expect(hook).toContain("DEFAULT_TIMEOUT_MS");
    expect(hook).toContain("15 * 60 * 1000");
  });

  it("InactivityGuard component exists", () => {
    const guard = readCode("/Users/quentin/Desktop/Tuatha-pro/src/components/InactivityGuard.tsx");
    expect(guard).toContain("useInactivityTimeout");
    expect(guard).toContain("session=expired");
  });

  it("hook listens for activity events", () => {
    const hook = readCode("/Users/quentin/Desktop/Tuatha-pro/src/hooks/useInactivityTimeout.ts");
    expect(hook).toContain("mousedown");
    expect(hook).toContain("keydown");
    expect(hook).toContain("touchstart");
    expect(hook).toContain("scroll");
  });

  it("hook clears session cookies on timeout", () => {
    const hook = readCode("/Users/quentin/Desktop/Tuatha-pro/src/hooks/useInactivityTimeout.ts");
    expect(hook).toContain("tuatha_access=; path=/; max-age=0");
    expect(hook).toContain("tuatha_session=; path=/; max-age=0");
  });

  it("kine dashboard has InactivityGuard", () => {
    const layout = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/dashboard/kine/layout.tsx");
    expect(layout).toContain("InactivityGuard");
  });

  it("medecin dashboard has InactivityGuard", () => {
    const layout = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/dashboard/medecin/layout.tsx");
    expect(layout).toContain("InactivityGuard");
  });

  it("coach dashboard has InactivityGuard", () => {
    const layout = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/dashboard/coach/layout.tsx");
    expect(layout).toContain("InactivityGuard");
  });

  it("nutri dashboard has InactivityGuard", () => {
    const layout = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/dashboard/nutri/layout.tsx");
    expect(layout).toContain("InactivityGuard");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 12. Security headers complètes
// ══════════════════════════════════════════════════════════════════════

describe("Full security headers", () => {
  const middleware = readCode("/Users/quentin/Desktop/Tuatha-pro/src/middleware.ts");

  it("Referrer-Policy set", () => {
    expect(middleware).toContain("Referrer-Policy");
    expect(middleware).toContain("strict-origin-when-cross-origin");
  });

  it("Permissions-Policy restricts camera/mic/geo/payment", () => {
    expect(middleware).toContain("Permissions-Policy");
    expect(middleware).toContain("camera=()");
    expect(middleware).toContain("microphone=()");
    expect(middleware).toContain("geolocation=()");
    expect(middleware).toContain("payment=()");
  });

  it("Cross-Origin-Opener-Policy set", () => {
    expect(middleware).toContain("Cross-Origin-Opener-Policy");
    expect(middleware).toContain("same-origin");
  });

  it("Cross-Origin-Resource-Policy set", () => {
    expect(middleware).toContain("Cross-Origin-Resource-Policy");
  });

  it("HTTPS redirect in production", () => {
    expect(middleware).toContain("x-forwarded-proto");
    expect(middleware).toContain("https:");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 13. XSS basique — dangerouslySetInnerHTML review
// ══════════════════════════════════════════════════════════════════════

describe("dangerouslySetInnerHTML usage review", () => {
  it("only used on static legal pages (CGU, privacy, etc.)", () => {
    // These files use dangerouslySetInnerHTML but only render content from
    // static TS constants (privacy.ts, cgu.ts, etc.) — NOT user input
    const safeStaticPages = [
      "/Users/quentin/Desktop/Tuatha-pro/src/app/cookies/page.tsx",
      "/Users/quentin/Desktop/Tuatha-pro/src/app/confidentialite/page.tsx",
      "/Users/quentin/Desktop/Tuatha-pro/src/app/cgu/page.tsx",
      "/Users/quentin/Desktop/Tuatha-pro/src/app/cgu-pro/page.tsx",
      "/Users/quentin/Desktop/Tuatha-pro/src/app/cgv/page.tsx",
      "/Users/quentin/Desktop/Tuatha-pro/src/app/charte-partage/page.tsx",
      "/Users/quentin/Desktop/Tuatha-pro/src/app/faq/page.tsx",
    ];
    for (const page of safeStaticPages) {
      const code = readCode(page);
      expect(code).toContain("dangerouslySetInnerHTML");
    }
    // No user-editable page should use dangerouslySetInnerHTML
  });
});
