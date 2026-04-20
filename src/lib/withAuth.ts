import { NextRequest, NextResponse } from "next/server";
import { getSessionPro, type SessionData, getSessionIp } from "@/lib/session";
import { hasPermission, isValidRole, resolveRole, type Role, type Resource, type Action } from "@/lib/rbac";
import { detectVpnCached, logVpnDetection } from "@/lib/vpnDetect";
import { securityMonitor } from "@/lib/securityMonitor";
import { incident } from "@/lib/incidentResponse";

// ─── Authenticated request context ───

export interface AuthContext {
  session: SessionData;
  role: Role;
}

type AuthHandler = (
  request: NextRequest,
  ctx: AuthContext,
  routeCtx?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

// ─── Options ───

interface WithAuthOptions {
  resource?: Resource;
  action?: Action;
  roles?: Role[];       // Whitelist specific roles (overrides resource check)
}

// ─── Main wrapper ───

export function withAuth(handler: AuthHandler, options: WithAuthOptions = {}) {
  return async (request: NextRequest, routeCtx?: { params: Promise<Record<string, string>> }) => {
   try {
    // 1. Authenticate
    const session = await getSessionPro();
    if (!session) {
      // Distinguish "expired but refreshable" from "truly unauthenticated"
      // The client should call POST /api/auth/refresh when it sees TOKEN_EXPIRED
      return NextResponse.json(
        { error: "Non authentifié.", code: "TOKEN_EXPIRED" },
        { status: 401 }
      );
    }

    // 1b. Anti-MITM: detect IP change (possible session hijack)
    const currentIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip") || null;
    if (currentIp) {
      const sessionIp = await getSessionIp(session.sessionId);
      if (sessionIp && sessionIp !== currentIp) {
        console.warn(`[MITM-DETECT] IP mismatch: session=${session.sessionId} user=${session.id} ` +
          `stored=${sessionIp} current=${currentIp} path=${request.nextUrl.pathname}`);
      }
    }

    // 2. Validate role
    if (!isValidRole(session.specialite)) {
      return NextResponse.json({ error: "Rôle invalide." }, { status: 403 });
    }
    const role: Role = resolveRole(session.specialite);

    // 3. Check role whitelist (if provided)
    if (options.roles && !options.roles.includes(role)) {
      return NextResponse.json(
        { error: "Accès non autorisé pour votre spécialité." },
        { status: 403 }
      );
    }

    // 4. Check resource permission (if provided)
    if (options.resource) {
      const action = options.action || methodToAction(request.method);
      if (!hasPermission(role, options.resource, action)) {
        return NextResponse.json(
          { error: "Vous n'avez pas la permission d'effectuer cette action." },
          { status: 403 }
        );
      }
    }

    // 5. VPN / Proxy / Tor detection — ACTIVE BLOCKING
    const vpn = await detectVpnCached(request);
    if (vpn.isVpn) {
      logVpnDetection(session.id, vpn, request.nextUrl.pathname);
    }

    // 5b. BLOCK if VPN detected with high confidence
    if (vpn.isBlocked) {
      console.warn(
        `[VPN-BLOCK] Blocked request from ${vpn.ip} score=${vpn.score} ` +
        `signals=[${vpn.signals.join(",")}] user=${session.id} path=${request.nextUrl.pathname}`,
      );
      return NextResponse.json(
        {
          error: "Connexion VPN/proxy détectée. L'utilisation d'un VPN n'est pas autorisée sur Tuatha Pro. Veuillez vous connecter sans VPN.",
          code: "VPN_BLOCKED",
          score: vpn.score,
          ip: vpn.ip,
        },
        { status: 403 },
      );
    }

    // 6. Read-only mode: block all write operations during incidents
    const method = request.method.toUpperCase();
    if (incident.isReadOnly() && (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")) {
      return NextResponse.json(
        {
          error: "Le système est temporairement en mode lecture seule pour maintenance de sécurité.",
          code: "READ_ONLY_MODE",
          reason: incident.getReadOnlyReason(),
        },
        { status: 503 },
      );
    }

    // 7. Track write actions for anomaly detection
    if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
      securityMonitor.trackWriteAction(session.id, request.nextUrl.pathname);
    }

    // 8. Delegate to handler
    const response = await handler(request, { session, role }, routeCtx);

    // Inject VPN warning header if detected but not blocked (low score)
    if (vpn.isVpn && response.headers) {
      response.headers.set("X-Vpn-Detected", "true");
      response.headers.set("X-Vpn-Score", String(vpn.score));
      response.headers.set("X-Vpn-Recommendation", vpn.recommendation);
    }

    return response;
   } catch (err) {
    console.error("[withAuth] unhandled error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Erreur interne withAuth", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
   }
  };
}

// ─── Convenience wrappers ───

/** Require authentication only (no role/permission check) */
export function withAuthOnly(handler: AuthHandler) {
  return withAuth(handler);
}

/** Require authentication + specific roles */
export function withRoles(roles: Role[], handler: AuthHandler) {
  return withAuth(handler, { roles });
}

/** Require authentication + specific resource permission */
export function withPermission(resource: Resource, handler: AuthHandler, action?: Action) {
  return withAuth(handler, { resource, action });
}

// ─── Helper ───

function methodToAction(method: string): Action {
  switch (method.toUpperCase()) {
    case "GET": return "read";
    case "POST": return "write";
    case "PUT": return "write";
    case "PATCH": return "write";
    case "DELETE": return "delete";
    default: return "read";
  }
}
