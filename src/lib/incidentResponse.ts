// ─── Incident Response: Emergency Controls ───
//
// Provides infrastructure-level emergency controls for security incidents.
// All controls are in-memory with structured logging for audit trail.
//
// Controls:
//   1. Global session revocation — force-logout every user
//   2. Read-only mode — block all write operations (POST/PUT/PATCH/DELETE)
//   3. Integration kill switches — disable external API calls per service
//   4. Key rotation guidance — documented procedure for secret rotation
//
// Usage:
//   import { incident } from "@/lib/incidentResponse";
//   incident.activateReadOnly("Data breach suspected — freezing writes");
//   incident.killIntegration("google", "OAuth compromise suspected");
//   incident.revokeAllTokens("Credential leak detected");
//   incident.getStatus();

import { prisma } from "@/lib/prisma";

// ─── Types ───

export type Integration =
  | "google"       // Google OAuth + Maps
  | "outlook"      // Outlook OAuth
  | "calendly"     // Calendly
  | "openai"       // OpenAI document verification
  | "resend"       // Resend email
  | "all";

export type IncidentSeverity = "warning" | "critical" | "emergency";

export interface IncidentEvent {
  id: string;
  timestamp: string;
  action: string;
  reason: string;
  severity: IncidentSeverity;
  actor: string;         // "system" or proId who triggered it
  metadata?: Record<string, unknown>;
}

// ─── State ───

interface IncidentState {
  readOnly: boolean;
  readOnlyReason: string | null;
  readOnlyActivatedAt: string | null;
  readOnlyActivatedBy: string | null;

  killedIntegrations: Map<string, { reason: string; killedAt: string; killedBy: string }>;

  lastGlobalRevocation: string | null;
  lastGlobalRevocationBy: string | null;

  events: IncidentEvent[];
}

const state: IncidentState = {
  readOnly: false,
  readOnlyReason: null,
  readOnlyActivatedAt: null,
  readOnlyActivatedBy: null,
  killedIntegrations: new Map(),
  lastGlobalRevocation: null,
  lastGlobalRevocationBy: null,
  events: [],
};

const MAX_EVENTS = 1000;
let eventCounter = 0;

// ─── Event logging ───

function logEvent(
  action: string,
  reason: string,
  severity: IncidentSeverity,
  actor = "system",
  metadata?: Record<string, unknown>,
): IncidentEvent {
  eventCounter++;
  const event: IncidentEvent = {
    id: `inc_${Date.now()}_${eventCounter}`,
    timestamp: new Date().toISOString(),
    action,
    reason,
    severity,
    actor,
    metadata,
  };

  state.events.push(event);
  if (state.events.length > MAX_EVENTS) {
    state.events.splice(0, state.events.length - MAX_EVENTS);
  }

  // Structured log for log aggregation
  const logFn = severity === "emergency" ? console.error : console.warn;
  logFn(
    `[INCIDENT-RESPONSE] ${severity.toUpperCase()} action=${action} actor=${actor} — ${reason}`,
    metadata ? JSON.stringify(metadata) : "",
  );

  return event;
}

// ─── Public API ───

export const incident = {

  // ════════════════════════════════════════════
  // 1. READ-ONLY MODE
  // ════════════════════════════════════════════

  /**
   * Activate read-only mode. All POST/PUT/PATCH/DELETE requests
   * through withAuth will be rejected with 503.
   */
  activateReadOnly(reason: string, actor = "system"): void {
    if (state.readOnly) return; // Already active

    state.readOnly = true;
    state.readOnlyReason = reason;
    state.readOnlyActivatedAt = new Date().toISOString();
    state.readOnlyActivatedBy = actor;

    logEvent("read_only_activated", reason, "emergency", actor, {
      activatedAt: state.readOnlyActivatedAt,
    });
  },

  /**
   * Deactivate read-only mode. Writes are allowed again.
   */
  deactivateReadOnly(actor = "system"): void {
    if (!state.readOnly) return;

    const duration = state.readOnlyActivatedAt
      ? Date.now() - new Date(state.readOnlyActivatedAt).getTime()
      : 0;

    logEvent("read_only_deactivated", "Read-only mode désactivé", "warning", actor, {
      durationMs: duration,
      durationMin: Math.round(duration / 60000),
    });

    state.readOnly = false;
    state.readOnlyReason = null;
    state.readOnlyActivatedAt = null;
    state.readOnlyActivatedBy = null;
  },

  /** Check if read-only mode is active. */
  isReadOnly(): boolean {
    return state.readOnly;
  },

  /** Get read-only reason (for error messages). */
  getReadOnlyReason(): string | null {
    return state.readOnlyReason;
  },

  // ════════════════════════════════════════════
  // 2. INTEGRATION KILL SWITCHES
  // ════════════════════════════════════════════

  /**
   * Kill an external integration. All calls to this service will be
   * short-circuited and return an error without making the external request.
   */
  killIntegration(integration: Integration, reason: string, actor = "system"): void {
    const targets = integration === "all"
      ? ["google", "outlook", "calendly", "openai", "resend"]
      : [integration];

    for (const target of targets) {
      if (state.killedIntegrations.has(target)) continue;

      state.killedIntegrations.set(target, {
        reason,
        killedAt: new Date().toISOString(),
        killedBy: actor,
      });

      logEvent("integration_killed", `${target}: ${reason}`, "critical", actor, {
        integration: target,
      });
    }
  },

  /**
   * Restore an integration.
   */
  restoreIntegration(integration: Integration, actor = "system"): void {
    const targets = integration === "all"
      ? [...state.killedIntegrations.keys()]
      : [integration];

    for (const target of targets) {
      const info = state.killedIntegrations.get(target);
      if (!info) continue;

      const duration = Date.now() - new Date(info.killedAt).getTime();
      state.killedIntegrations.delete(target);

      logEvent("integration_restored", `${target} restauré`, "warning", actor, {
        integration: target,
        downDurationMs: duration,
        downDurationMin: Math.round(duration / 60000),
      });
    }
  },

  /**
   * Check if an integration is killed.
   * Use this in integration code to short-circuit calls.
   */
  isIntegrationKilled(integration: string): boolean {
    return state.killedIntegrations.has(integration);
  },

  /**
   * Get kill reason for an integration (for error messages).
   */
  getKillReason(integration: string): string | null {
    return state.killedIntegrations.get(integration)?.reason || null;
  },

  // ════════════════════════════════════════════
  // 3. GLOBAL TOKEN REVOCATION
  // ════════════════════════════════════════════

  /**
   * Revoke ALL active sessions for ALL users.
   * Nuclear option — forces every user to re-login.
   * Returns the number of revoked sessions.
   */
  async revokeAllTokens(reason: string, actor = "system"): Promise<number> {
    const result = await prisma.authSession.updateMany({
      where: { revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: `incident:${reason}`,
      },
    });

    state.lastGlobalRevocation = new Date().toISOString();
    state.lastGlobalRevocationBy = actor;

    logEvent("global_token_revocation", reason, "emergency", actor, {
      revokedCount: result.count,
      revokedAt: state.lastGlobalRevocation,
    });

    return result.count;
  },

  /**
   * Revoke all sessions for a specific user.
   * Use when a single account is compromised.
   */
  async revokeUserTokens(professionnelId: string, reason: string, actor = "system"): Promise<number> {
    const result = await prisma.authSession.updateMany({
      where: { professionnelId, revoked: false },
      data: {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: `incident:${reason}`,
      },
    });

    logEvent("user_token_revocation", `${professionnelId}: ${reason}`, "critical", actor, {
      professionnelId,
      revokedCount: result.count,
    });

    // Create security alert for the user
    prisma.securityAlert.create({
      data: {
        type: "sessions_revoked",
        message: `Toutes vos sessions ont été révoquées : ${reason}`,
        professionnelId,
      },
    }).catch(() => {});

    return result.count;
  },

  // ════════════════════════════════════════════
  // 4. KEY ROTATION
  // ════════════════════════════════════════════

  /**
   * Initiate key rotation procedure.
   * This logs the rotation event and returns the steps to follow.
   * Actual key changes require .env modification + restart.
   *
   * Returns a checklist of rotation steps.
   */
  initiateKeyRotation(
    keyType: "encryption" | "jwt" | "oauth_google" | "oauth_outlook" | "oauth_calendly" | "resend" | "openai" | "maps",
    reason: string,
    actor = "system",
  ): string[] {
    logEvent("key_rotation_initiated", `${keyType}: ${reason}`, "emergency", actor, {
      keyType,
    });

    const commonSteps = [
      `1. Générer une nouvelle clé pour ${keyType}`,
      `2. Mettre à jour .env avec la nouvelle valeur`,
      `3. Redémarrer le serveur (pm2 restart / docker restart)`,
      `4. Vérifier les logs pour confirmer le démarrage OK`,
    ];

    const specificSteps: Record<string, string[]> = {
      encryption: [
        ...commonSteps,
        "5. ATTENTION : les données chiffrées avec l'ancienne clé devront être re-chiffrées",
        "6. Commande : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
        "7. Révoquer toutes les sessions : incident.revokeAllTokens('key_rotation')",
      ],
      jwt: [
        "1. Révoquer toutes les sessions : incident.revokeAllTokens('key_rotation')",
        "2. Les tokens en mémoire/cookies deviennent invalides automatiquement",
        "3. Tous les utilisateurs devront se reconnecter",
      ],
      oauth_google: [
        "1. Aller sur Google Cloud Console → Credentials",
        "2. Révoquer l'ancien client secret",
        "3. Créer un nouveau client secret",
        "4. Mettre à jour GOOGLE_CLIENT_SECRET dans .env",
        "5. incident.killIntegration('google', 'key_rotation') pendant la rotation",
        "6. Redémarrer, puis incident.restoreIntegration('google')",
      ],
      oauth_outlook: [
        "1. Aller sur Azure Portal → App Registrations",
        "2. Révoquer l'ancien client secret",
        "3. Créer un nouveau client secret",
        "4. Mettre à jour OUTLOOK_CLIENT_SECRET dans .env",
        "5. incident.killIntegration('outlook', 'key_rotation') pendant la rotation",
        "6. Redémarrer, puis incident.restoreIntegration('outlook')",
      ],
      oauth_calendly: [
        "1. Aller sur Calendly Developer Portal",
        "2. Régénérer le client secret",
        "3. Mettre à jour CALENDLY_CLIENT_SECRET dans .env",
        "4. incident.killIntegration('calendly', 'key_rotation') pendant la rotation",
        "5. Redémarrer, puis incident.restoreIntegration('calendly')",
      ],
      resend: [
        "1. Aller sur Resend Dashboard → API Keys",
        "2. Révoquer l'ancienne clé",
        "3. Créer une nouvelle clé",
        "4. Mettre à jour RESEND_API_KEY dans .env",
        "5. incident.killIntegration('resend', 'key_rotation') pendant la rotation",
        "6. Redémarrer, puis incident.restoreIntegration('resend')",
        "7. Envoyer un email test pour vérifier",
      ],
      openai: [
        "1. Aller sur OpenAI Platform → API Keys",
        "2. Révoquer l'ancienne clé",
        "3. Créer une nouvelle clé",
        "4. Mettre à jour OPENAI_API_KEY dans .env",
        "5. Redémarrer le serveur",
      ],
      maps: [
        "1. Aller sur Google Cloud Console → Credentials",
        "2. Restreindre l'ancienne clé (ne pas la supprimer tout de suite)",
        "3. Créer une nouvelle clé avec restrictions (HTTP referrer, IP)",
        "4. Mettre à jour GOOGLE_MAPS_API_KEY dans .env",
        "5. Redémarrer, puis supprimer l'ancienne clé après vérification",
      ],
    };

    return specificSteps[keyType] || commonSteps;
  },

  // ════════════════════════════════════════════
  // 5. STATUS & MONITORING
  // ════════════════════════════════════════════

  /**
   * Get the current incident response status (for admin dashboard).
   */
  getStatus(): {
    readOnly: boolean;
    readOnlyReason: string | null;
    readOnlySince: string | null;
    killedIntegrations: Record<string, { reason: string; killedAt: string }>;
    lastGlobalRevocation: string | null;
    recentEvents: IncidentEvent[];
  } {
    const killed: Record<string, { reason: string; killedAt: string }> = {};
    for (const [k, v] of state.killedIntegrations) {
      killed[k] = { reason: v.reason, killedAt: v.killedAt };
    }

    return {
      readOnly: state.readOnly,
      readOnlyReason: state.readOnlyReason,
      readOnlySince: state.readOnlyActivatedAt,
      killedIntegrations: killed,
      lastGlobalRevocation: state.lastGlobalRevocation,
      recentEvents: state.events.slice(-50).reverse(),
    };
  },

  /**
   * Get all incident events (for audit).
   */
  getEvents(limit = 100): IncidentEvent[] {
    return state.events.slice(-limit).reverse();
  },

  // ════════════════════════════════════════════
  // 6. FULL LOCKDOWN (combines all controls)
  // ════════════════════════════════════════════

  /**
   * FULL LOCKDOWN: activates all controls at once.
   * - Read-only mode ON
   * - Kill all integrations
   * - Revoke all tokens
   *
   * Use in case of confirmed data breach.
   */
  async fullLockdown(reason: string, actor = "system"): Promise<{
    readOnly: boolean;
    integrationsKilled: string[];
    sessionsRevoked: number;
  }> {
    logEvent("full_lockdown", reason, "emergency", actor);

    // 1. Read-only mode
    this.activateReadOnly(reason, actor);

    // 2. Kill all integrations
    this.killIntegration("all", reason, actor);

    // 3. Revoke all tokens
    const sessionsRevoked = await this.revokeAllTokens(reason, actor);

    return {
      readOnly: true,
      integrationsKilled: [...state.killedIntegrations.keys()],
      sessionsRevoked,
    };
  },

  /**
   * Lift lockdown: restore all controls.
   */
  liftLockdown(actor = "system"): void {
    logEvent("lockdown_lifted", "Lockdown levé — retour à la normale", "warning", actor);

    this.deactivateReadOnly(actor);
    this.restoreIntegration("all", actor);
  },
};
