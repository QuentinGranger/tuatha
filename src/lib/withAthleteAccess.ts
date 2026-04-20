// ─── ABAC Middleware: withAthleteAccess ───
// Composable with withAuth. Extracts athleteId from params/query/body,
// then checks contextual access (ownership or active ProConnection with scope).

import { NextRequest, NextResponse } from "next/server";
import { type AuthContext } from "@/lib/withAuth";
import { checkAthleteAccess, type AccessScope, type AccessResult, type DataScopeRequirement } from "@/lib/abac";
import { withAuth } from "@/lib/withAuth";
import type { Resource } from "@/lib/rbac";

// ─── Options ───

export interface AthleteAccessOptions {
  /** RBAC resource for the base withAuth permission check */
  resource?: Resource;
  /** Where to find the athleteId: "params" | "query" | "body" | "auto" (default: "auto") */
  athleteIdSource?: "params" | "query" | "body" | "auto";
  /** The param/query key name (default: "athleteId" for query/body, "id" for params) */
  athleteIdKey?: string;
  /** Required ABAC scopes — checked against ProConnection boolean fields (legacy) */
  scopes?: AccessScope[];
  /** Required data scope requirements — granular per-category + action level */
  dataRequirements?: DataScopeRequirement[];
  /** If true, skip ABAC check when no athleteId is provided (for list endpoints) */
  optional?: boolean;
}

// ─── Extended context with ABAC result ───

export interface AthleteAuthContext extends AuthContext {
  athleteAccess?: AccessResult;
  athleteId?: string;
}

type AthleteAccessHandler = (
  request: NextRequest,
  ctx: AthleteAuthContext,
  routeCtx?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

// ─── Main wrapper ───

export function withAthleteAccess(handler: AthleteAccessHandler, options: AthleteAccessOptions = {}) {
  const {
    resource,
    athleteIdSource = "auto",
    athleteIdKey,
    scopes = [],
    dataRequirements = [],
    optional = false,
  } = options;

  return withAuth(async (request: NextRequest, ctx: AuthContext, routeCtx?) => {
    const proId = ctx.session.id;

    // Extract athleteId from the appropriate source
    let athleteId: string | null = null;

    if (athleteIdSource === "params" || athleteIdSource === "auto") {
      if (routeCtx?.params) {
        const params = await routeCtx.params;
        const key = athleteIdKey || "id";
        if (params[key]) athleteId = params[key];
      }
    }

    if (!athleteId && (athleteIdSource === "query" || athleteIdSource === "auto")) {
      const key = athleteIdKey || "athleteId";
      athleteId = request.nextUrl.searchParams.get(key);
    }

    if (!athleteId && (athleteIdSource === "body" || athleteIdSource === "auto")) {
      // Only parse body for methods that have one
      if (["POST", "PUT", "PATCH"].includes(request.method)) {
        try {
          const cloned = request.clone();
          const body = await cloned.json();
          const key = athleteIdKey || "athleteId";
          if (body[key]) athleteId = body[key];
        } catch {
          // Body parsing failed — skip
        }
      }
    }

    // If no athleteId found
    if (!athleteId) {
      if (optional) {
        // Pass through without ABAC check (list endpoints without filter)
        return handler(request, { ...ctx, athleteId: undefined, athleteAccess: undefined }, routeCtx);
      }
      return NextResponse.json(
        { error: "Identifiant athlète manquant." },
        { status: 400 }
      );
    }

    // Run ABAC check (granular requirements + legacy scopes)
    const access = await checkAthleteAccess(proId, athleteId, dataRequirements, scopes);

    if (!access.granted) {
      const status = access.expired ? 403 : 403;
      return NextResponse.json(
        {
          error: access.reason || "Accès refusé à cet athlète.",
          expired: access.expired || false,
        },
        { status }
      );
    }

    // Pass enriched context to handler
    return handler(
      request,
      { ...ctx, athleteId, athleteAccess: access },
      routeCtx
    );
  }, { resource });
}
