// ─── Input Sanitization: Anti-XSS + Anti-Injection + Link Safety ───
//
// Sanitizes all user-generated text before storage:
//   1. Strip HTML tags and dangerous attributes
//   2. Neutralize javascript:, data:, vbscript: URIs
//   3. Detect and flag malicious/phishing links
//   4. Block encoded payloads (base64 scripts, etc.)
//   5. Enforce length limits
//
// Usage:
//   const safe = sanitizeMessage(rawInput);
//   if (!safe.ok) return NextResponse.json({ error: safe.reason }, { status: 400 });
//   // use safe.text

// ─── Types ───

export type SanitizeResult =
  | { ok: true; text: string; warnings: string[] }
  | { ok: false; reason: string };

// ─── Configuration ───

const MAX_MESSAGE_LENGTH = 5000;
const MAX_NOTE_LENGTH = 10000;
const MAX_SHORT_TEXT_LENGTH = 500;

// ─── Public API ───

/**
 * Sanitize a chat message. Strips HTML, blocks dangerous URIs, enforces length.
 */
export function sanitizeMessage(raw: unknown): SanitizeResult {
  return sanitizeText(raw, { maxLength: MAX_MESSAGE_LENGTH, context: "message" });
}

/**
 * Sanitize a note (collab notes, athlete notes). Slightly more permissive length.
 */
export function sanitizeNote(raw: unknown): SanitizeResult {
  return sanitizeText(raw, { maxLength: MAX_NOTE_LENGTH, context: "note" });
}

/**
 * Sanitize short metadata fields (category, label, role, etc.).
 */
export function sanitizeShortText(raw: unknown): SanitizeResult {
  return sanitizeText(raw, { maxLength: MAX_SHORT_TEXT_LENGTH, context: "champ" });
}

/**
 * Core sanitization function.
 */
export function sanitizeText(
  raw: unknown,
  opts: { maxLength: number; context: string },
): SanitizeResult {
  // Type check
  if (typeof raw !== "string") {
    return { ok: false, reason: `Le ${opts.context} doit être du texte.` };
  }

  let text = raw;

  // 1. Length check (before processing to avoid DoS on huge inputs)
  if (text.length > opts.maxLength * 2) {
    return { ok: false, reason: `${capitalize(opts.context)} trop long (max ${opts.maxLength} caractères).` };
  }

  const warnings: string[] = [];

  // 2. Strip HTML tags
  const hadHtml = /<[a-zA-Z][^>]*>/.test(text);
  text = stripHtml(text);
  if (hadHtml) {
    warnings.push("Balises HTML supprimées.");
  }

  // 3. Neutralize dangerous URI schemes
  const dangerousSchemes = /(?:javascript|vbscript|data|blob):/gi;
  if (dangerousSchemes.test(text)) {
    text = text.replace(dangerousSchemes, "[lien bloqué]:");
    warnings.push("Liens potentiellement dangereux neutralisés.");
  }

  // 4. Detect encoded payloads (base64-encoded scripts)
  const encodedCheck = detectEncodedPayload(text);
  if (encodedCheck) {
    return { ok: false, reason: "Contenu encodé suspect détecté." };
  }

  // 5. Detect script-like patterns in plain text
  const scriptPatterns = [
    /on\w+\s*=\s*["']/gi,           // Event handlers: onclick="..."
    /expression\s*\(/gi,             // CSS expression()
    /url\s*\(\s*["']?\s*javascript/gi, // CSS url(javascript:...)
    /<!\[CDATA\[/gi,                 // CDATA sections
    /\{\{.*\}\}/g,                   // Template injection {{ }}
    /\$\{.*\}/g,                     // Template literal injection ${ }
  ];

  for (const pattern of scriptPatterns) {
    if (pattern.test(text)) {
      text = text.replace(pattern, "[contenu filtré]");
      warnings.push("Contenu de script potentiel supprimé.");
    }
  }

  // 6. Normalize whitespace (collapse excessive newlines/spaces)
  text = text.replace(/\n{4,}/g, "\n\n\n");  // Max 3 consecutive newlines
  text = text.replace(/[ \t]{20,}/g, " ");    // Collapse excessive spaces

  // 7. Strip null bytes and control characters (except newline, tab)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 8. Final length check
  text = text.trim();
  if (text.length === 0) {
    return { ok: false, reason: `Le ${opts.context} ne peut pas être vide.` };
  }
  if (text.length > opts.maxLength) {
    return { ok: false, reason: `${capitalize(opts.context)} trop long (max ${opts.maxLength} caractères).` };
  }

  // 9. Check URLs in text for suspicious patterns
  const urlWarnings = checkUrls(text);
  warnings.push(...urlWarnings);

  return { ok: true, text, warnings };
}

// ─── HTML Stripping ───

function stripHtml(input: string): string {
  // Remove all HTML tags, keeping text content
  let text = input;

  // Remove script/style blocks entirely (including content)
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

  // Re-check after entity decoding (double-encoding attacks)
  text = text.replace(/<[^>]+>/g, "");

  return text;
}

// ─── Encoded Payload Detection ───

function detectEncodedPayload(text: string): boolean {
  // Look for base64-encoded strings that could contain scripts
  const base64Pattern = /(?:atob|btoa|base64)\s*[(\[]/i;
  if (base64Pattern.test(text)) return true;

  // Long base64-like strings (>100 chars of [A-Za-z0-9+/=])
  const longBase64 = /[A-Za-z0-9+/]{100,}={0,2}/;
  if (longBase64.test(text)) {
    // Try to decode and check for script content
    const match = text.match(longBase64);
    if (match) {
      try {
        const decoded = Buffer.from(match[0], "base64").toString("utf8");
        if (/<script/i.test(decoded) || /javascript:/i.test(decoded) || /on\w+=/i.test(decoded)) {
          return true;
        }
      } catch {
        // Not valid base64, ignore
      }
    }
  }

  // Hex-encoded payloads (\x3c\x73\x63\x72\x69\x70\x74 = <script)
  const hexPattern = /(?:\\x[0-9a-fA-F]{2}){4,}/;
  if (hexPattern.test(text)) {
    try {
      const decoded = text.replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      if (/<script/i.test(decoded) || /javascript:/i.test(decoded)) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  // Unicode escape sequences (\u003c\u0073\u0063\u0072\u0069\u0070\u0074 = <script)
  const unicodePattern = /(?:\\u[0-9a-fA-F]{4}){4,}/;
  if (unicodePattern.test(text)) {
    try {
      const decoded = text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      if (/<script/i.test(decoded) || /javascript:/i.test(decoded)) {
        return true;
      }
    } catch {
      // ignore
    }
  }

  return false;
}

// ─── URL Safety Check ───

function checkUrls(text: string): string[] {
  const warnings: string[] = [];

  // Extract URLs from text
  const urlPattern = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlPattern) || [];

  for (const url of urls) {
    try {
      const parsed = new URL(url);

      // Check for IP-based URLs (often phishing)
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(parsed.hostname)) {
        warnings.push(`Lien vers adresse IP détecté (${parsed.hostname}).`);
      }

      // Check for suspicious TLDs commonly used in phishing
      const suspiciousTlds = [".tk", ".ml", ".ga", ".cf", ".gq", ".top", ".xyz", ".buzz", ".click", ".loan"];
      if (suspiciousTlds.some((tld) => parsed.hostname.endsWith(tld))) {
        warnings.push(`Lien vers domaine suspect détecté (${parsed.hostname}).`);
      }

      // Check for homograph attacks (mixed scripts in domain)
      if (/[^\x00-\x7F]/.test(parsed.hostname)) {
        warnings.push(`Lien avec caractères internationaux dans le domaine (possible homographe).`);
      }

      // Check for excessively long URLs (possible obfuscation)
      if (url.length > 2000) {
        warnings.push("Lien excessivement long détecté.");
      }

      // Check for URL shorteners (could hide malicious destination)
      const shorteners = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "adf.ly", "bl.ink", "lnkd.in"];
      if (shorteners.includes(parsed.hostname)) {
        warnings.push(`Lien raccourci détecté (${parsed.hostname}) — destination inconnue.`);
      }
    } catch {
      // Malformed URL, not a concern
    }
  }

  return warnings;
}

// ─── Recursive Body Sanitizer ───
//
// Sanitizes ALL string values in a request body (nested objects & arrays).
// Use this in API routes that accept free-text user content.
//
// Usage:
//   const body = sanitizeBody(await request.json());
//   // All strings in body are now XSS-safe

/**
 * Recursively sanitize all string values in an object/array.
 * Non-string primitives (numbers, booleans, null) pass through unchanged.
 * Skips fields listed in `skipFields` (e.g. "password", "token").
 */
export function sanitizeBody<T>(input: T, skipFields: string[] = ["password", "passwordConfirm", "token", "currentPassword", "newPassword"]): T {
  if (input === null || input === undefined) return input;

  if (typeof input === "string") {
    return sanitizeStringValue(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeBody(item, skipFields)) as unknown as T;
  }

  if (typeof input === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (skipFields.includes(key)) {
        result[key] = value; // Don't touch passwords/tokens
      } else {
        result[key] = sanitizeBody(value, skipFields);
      }
    }
    return result as T;
  }

  return input; // numbers, booleans, etc.
}

/**
 * Sanitize a single string value: strip HTML, neutralize dangerous URIs,
 * remove null bytes and control chars. Lightweight version of sanitizeText
 * that doesn't enforce length limits or return a result object.
 */
export function sanitizeString(raw: unknown): string {
  if (typeof raw !== "string") return String(raw ?? "");
  return sanitizeStringValue(raw);
}

function sanitizeStringValue(text: string): string {
  // Strip HTML tags
  let s = text;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<[^>]+>/g, "");

  // Decode HTML entities then re-strip (double-encoding attacks)
  s = s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
       .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");
  s = s.replace(/<[^>]+>/g, "");

  // Neutralize dangerous URI schemes
  s = s.replace(/(?:javascript|vbscript|data|blob):/gi, "[lien bloqué]:");

  // Remove event handlers
  s = s.replace(/on\w+\s*=\s*["']/gi, "[filtré]");

  // Strip null bytes and control characters (except newline, tab)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return s;
}

// ─── Helpers ───

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
