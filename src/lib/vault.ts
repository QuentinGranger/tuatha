// ─── Secrets Vault ───
// Centralized access to all secrets, API keys, tokens, and sensitive configuration.
// NEVER access process.env directly outside this file.
//
// Benefits:
//   - Single source of truth for all secrets
//   - Fail-fast validation at startup (missing required secrets)
//   - Categorized secrets (auth, email, AI, maps, calendar, encryption, app)
//   - Typed access with clear error messages
//   - Easy migration to external vault (AWS Secrets Manager, Hashicorp Vault, etc.)

// ─── Secret definition ───

interface SecretDef {
  env: string;                    // Environment variable name
  required: boolean;              // Fail at startup if missing?
  category: SecretCategory;
  description: string;
  sensitive?: boolean;            // If true, never log the value
  defaultValue?: string;          // Fallback (only for non-sensitive config)
}

type SecretCategory = "auth" | "email" | "ai" | "maps" | "calendar" | "encryption" | "app" | "database" | "webauthn";

// ─── Registry ───

const SECRETS_REGISTRY: Record<string, SecretDef> = {
  // ── Database ──
  DATABASE_URL: {
    env: "DATABASE_URL",
    required: true,
    category: "database",
    description: "PostgreSQL connection string (must include ?sslmode=require in production)",
    sensitive: true,
  },

  // ── App ──
  APP_URL: {
    env: "NEXT_PUBLIC_APP_URL",
    required: false,
    category: "app",
    description: "Public application URL",
    defaultValue: "http://localhost:3000",
  },
  NODE_ENV: {
    env: "NODE_ENV",
    required: false,
    category: "app",
    description: "Runtime environment",
    defaultValue: "development",
  },

  // ── Auth (Google OAuth) ──
  GOOGLE_CLIENT_ID: {
    env: "GOOGLE_CLIENT_ID",
    required: false,
    category: "auth",
    description: "Google OAuth2 client ID",
    sensitive: true,
  },
  GOOGLE_CLIENT_SECRET: {
    env: "GOOGLE_CLIENT_SECRET",
    required: false,
    category: "auth",
    description: "Google OAuth2 client secret",
    sensitive: true,
  },
  GOOGLE_REDIRECT_URI: {
    env: "GOOGLE_REDIRECT_URI",
    required: false,
    category: "auth",
    description: "Google OAuth2 redirect URI",
    defaultValue: "http://localhost:3000/api/auth/google/callback",
  },

  // ── Auth (Outlook OAuth) ──
  OUTLOOK_CLIENT_ID: {
    env: "OUTLOOK_CLIENT_ID",
    required: false,
    category: "auth",
    description: "Microsoft Outlook OAuth2 client ID",
    sensitive: true,
  },
  OUTLOOK_CLIENT_SECRET: {
    env: "OUTLOOK_CLIENT_SECRET",
    required: false,
    category: "auth",
    description: "Microsoft Outlook OAuth2 client secret",
    sensitive: true,
  },
  OUTLOOK_REDIRECT_URI: {
    env: "OUTLOOK_REDIRECT_URI",
    required: false,
    category: "auth",
    description: "Microsoft Outlook OAuth2 redirect URI",
    defaultValue: "http://localhost:3000/api/auth/outlook/callback",
  },

  // ── Calendar (Calendly) ──
  CALENDLY_CLIENT_ID: {
    env: "CALENDLY_CLIENT_ID",
    required: false,
    category: "calendar",
    description: "Calendly OAuth2 client ID",
    sensitive: true,
  },
  CALENDLY_CLIENT_SECRET: {
    env: "CALENDLY_CLIENT_SECRET",
    required: false,
    category: "calendar",
    description: "Calendly OAuth2 client secret",
    sensitive: true,
  },
  CALENDLY_REDIRECT_URI: {
    env: "CALENDLY_REDIRECT_URI",
    required: false,
    category: "calendar",
    description: "Calendly OAuth2 redirect URI",
    defaultValue: "http://localhost:3000/api/auth/calendly/callback",
  },

  // ── Email (Resend) ──
  RESEND_API_KEY: {
    env: "RESEND_API_KEY",
    required: true,
    category: "email",
    description: "Resend API key for transactional emails",
    sensitive: true,
  },
  RESEND_FROM_EMAIL: {
    env: "RESEND_FROM_EMAIL",
    required: false,
    category: "email",
    description: "Default sender email address",
    defaultValue: "Tuatha Pro <noreply@tuatha-app.com>",
  },

  // ── AI (OpenAI) ──
  OPENAI_API_KEY: {
    env: "OPENAI_API_KEY",
    required: false,
    category: "ai",
    description: "OpenAI API key for document verification",
    sensitive: true,
  },

  // ── Maps (Google) ──
  GOOGLE_MAPS_API_KEY: {
    env: "GOOGLE_MAPS_API_KEY",
    required: false,
    category: "maps",
    description: "Google Maps/Places API key",
    sensitive: true,
  },

  // ── Encryption ──
  ENCRYPTION_KEY: {
    env: "ENCRYPTION_KEY",
    required: true,
    category: "encryption",
    description: "AES-256 encryption key (64 hex chars). Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    sensitive: true,
  },

  // ── WebAuthn (Passkeys) ──
  WEBAUTHN_RP_ID: {
    env: "WEBAUTHN_RP_ID",
    required: false,
    category: "webauthn",
    description: "WebAuthn Relying Party ID (domain)",
    defaultValue: "localhost",
  },

  // ── Web Push (VAPID) ──
  VAPID_PUBLIC_KEY: {
    env: "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    required: false,
    category: "app",
    description: "VAPID public key for Web Push notifications. Generate: npx web-push generate-vapid-keys",
  },
  VAPID_PRIVATE_KEY: {
    env: "VAPID_PRIVATE_KEY",
    required: false,
    category: "app",
    description: "VAPID private key for Web Push notifications",
    sensitive: true,
  },
};

// ─── Vault singleton ───

class Vault {
  private cache = new Map<string, string | undefined>();
  private validated = false;

  /** Get a secret by registry key. Throws if required and missing. */
  get(key: keyof typeof SECRETS_REGISTRY): string {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const def = SECRETS_REGISTRY[key];
    if (!def) throw new Error(`[Vault] Unknown secret key: ${key}`);

    const value = process.env[def.env] || def.defaultValue;

    if (!value && def.required) {
      throw new Error(
        `[Vault] Missing required secret: ${def.env} (${def.description})`
      );
    }

    this.cache.set(key, value);
    return value || "";
  }

  /** Get a secret or null if not set. Never throws. */
  getOptional(key: keyof typeof SECRETS_REGISTRY): string | null {
    const def = SECRETS_REGISTRY[key];
    if (!def) return null;
    const value = process.env[def.env] || def.defaultValue;
    return value || null;
  }

  /** Check if a secret is configured (non-empty). */
  has(key: keyof typeof SECRETS_REGISTRY): boolean {
    const def = SECRETS_REGISTRY[key];
    if (!def) return false;
    return !!(process.env[def.env] || def.defaultValue);
  }

  /** Validate all required secrets exist. Call once at startup. */
  validate(): { valid: boolean; missing: string[]; warnings: string[] } {
    if (this.validated) return { valid: true, missing: [], warnings: [] };

    const missing: string[] = [];
    const warnings: string[] = [];

    for (const [key, def] of Object.entries(SECRETS_REGISTRY)) {
      const value = process.env[def.env] || def.defaultValue;

      if (!value) {
        if (def.required) {
          missing.push(`${def.env} — ${def.description}`);
        } else {
          warnings.push(`${def.env} — ${def.description} (optional, using default or disabled)`);
        }
      }
    }

    if (missing.length > 0) {
      console.error(
        `\n🔴 [Vault] Missing ${missing.length} required secret(s):\n` +
        missing.map((m) => `   ✗ ${m}`).join("\n") + "\n"
      );
    }

    if (warnings.length > 0 && process.env.NODE_ENV !== "production") {
      console.warn(
        `\n🟡 [Vault] ${warnings.length} optional secret(s) not configured:\n` +
        warnings.map((w) => `   ○ ${w}`).join("\n") + "\n"
      );
    }

    this.validated = true;
    return { valid: missing.length === 0, missing, warnings };
  }

  /** Audit: list all secrets and their status (never logs values). */
  audit(): Record<string, { category: SecretCategory; configured: boolean; required: boolean }> {
    const result: Record<string, { category: SecretCategory; configured: boolean; required: boolean }> = {};
    for (const [key, def] of Object.entries(SECRETS_REGISTRY)) {
      result[key] = {
        category: def.category,
        configured: !!(process.env[def.env] || def.defaultValue),
        required: def.required,
      };
    }
    return result;
  }

  /** Check if running in production. */
  isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  }
}

// ─── Export singleton ───

export const vault = new Vault();

// ─── Convenience accessors (typed shortcuts) ───

export const secrets = {
  // Database
  databaseUrl: () => vault.get("DATABASE_URL"),

  // App
  appUrl: () => vault.get("APP_URL"),
  isProduction: () => vault.isProduction(),

  // Auth — Google
  googleClientId: () => vault.get("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => vault.get("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: () => vault.get("GOOGLE_REDIRECT_URI"),

  // Auth — Outlook
  outlookClientId: () => vault.get("OUTLOOK_CLIENT_ID"),
  outlookClientSecret: () => vault.get("OUTLOOK_CLIENT_SECRET"),
  outlookRedirectUri: () => vault.get("OUTLOOK_REDIRECT_URI"),

  // Calendar — Calendly
  calendlyClientId: () => vault.get("CALENDLY_CLIENT_ID"),
  calendlyClientSecret: () => vault.get("CALENDLY_CLIENT_SECRET"),
  calendlyRedirectUri: () => vault.get("CALENDLY_REDIRECT_URI"),

  // Email — Resend
  resendApiKey: () => vault.get("RESEND_API_KEY"),
  resendFromEmail: () => vault.get("RESEND_FROM_EMAIL"),

  // AI — OpenAI
  openaiApiKey: () => vault.get("OPENAI_API_KEY"),
  hasOpenAI: () => vault.has("OPENAI_API_KEY"),

  // Maps — Google
  googleMapsApiKey: () => vault.get("GOOGLE_MAPS_API_KEY"),

  // Encryption
  encryptionKey: () => vault.get("ENCRYPTION_KEY"),

  // WebAuthn
  webauthnRpId: () => vault.get("WEBAUTHN_RP_ID"),

  // Web Push
  vapidPublicKey: () => vault.get("VAPID_PUBLIC_KEY"),
  vapidPrivateKey: () => vault.get("VAPID_PRIVATE_KEY"),
  hasWebPush: () => vault.has("VAPID_PUBLIC_KEY") && vault.has("VAPID_PRIVATE_KEY"),
} as const;
