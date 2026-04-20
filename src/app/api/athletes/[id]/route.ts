import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAthleteAccess } from "@/lib/withAthleteAccess";
import { validateBody, updateAthleteSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";
import { securityMonitor } from "@/lib/securityMonitor";
import { consent } from "@/lib/consent";
import { signAvatarUrl } from "@/lib/signedUrl";
import { getPrivacySettings, applyPrivacyFilter, logAccess } from "@/lib/privacyGuard";

// GET /api/athletes/:id — full profile + notes
export const GET = withAthleteAccess(async (_request, ctx, routeCtx) => {
  try {
    const { id } = await routeCtx!.params;
    securityMonitor.trackAthleteAccess(ctx.session.id, id);

    // Owner gets full data; connection gets scoped data
    if (ctx.athleteAccess?.accessType === "owner") {
      const athlete = await prisma.athlete.findFirst({
        where: { id, professionnelId: ctx.session.id },
        include: {
          notes: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      });

      // Fallback: check if this is a connected AthleteUser
      if (!athlete) {
        const conn = await (prisma as any).connectionRequest.findFirst({
          where: { athleteUserId: id, professionnelId: ctx.session.id, status: "accepted" },
          include: {
            athleteUser: {
              select: {
                id: true, nom: true, prenom: true, sport: true,
                objectif: true, dateNaissance: true, taille: true, poids: true,
                antecedents: true, traitements: true, contreIndications: true,
                avatarPath: true, createdAt: true, updatedAt: true,
              },
            },
          },
        });
        if (!conn?.athleteUser) return NextResponse.json({ error: "Athlète introuvable" }, { status: 404 });
        const au = conn.athleteUser;

        // ── Privacy enforcement: respect athlete's choices ──
        const privacy = await getPrivacySettings(au.id, ctx.session.id);
        logAccess(au.id, ctx.session.id, "view_profile");
        const raw: Record<string, unknown> = {
          id: au.id,
          name: `${au.prenom} ${au.nom}`,
          sport: au.sport || null,
          status: "active",
          riskLevel: "GOOD",
          trend: "STAGNATING",
          lastContactAt: conn.respondedAt || conn.createdAt,
          objectif: au.objectif || null,
          motif: null,
          bodyZone: null,
          consentement: true,
          consentementDate: null,
          dateNaissance: au.dateNaissance,
          taille: au.taille,
          poids: au.poids,
          antecedents: au.antecedents || [],
          traitements: au.traitements || null,
          contreIndications: au.contreIndications || null,
          contactEmail: null,
          contactPhone: null,
          frequence: null,
          dataTracking: [],
          canalCommunication: null,
          injuryNote: null,
          latestNote: null,
          professionnelId: ctx.session.id,
          createdAt: conn.createdAt,
          updatedAt: au.updatedAt,
          avatarUrl: signAvatarUrl(au.avatarPath),
          notes: [],
          _count: { notes: 0 },
          _source: "athlete_user",
          _athleteUserId: au.id,
        };
        return NextResponse.json(applyPrivacyFilter(raw, privacy));
      }

      return NextResponse.json(athlete);
    }

    // Shared access — limited fields
    const athlete = await prisma.athlete.findFirst({
      where: { id },
      select: {
        id: true, name: true, sport: true, status: true,
        bodyZone: true, motif: true, objectif: true,
        riskLevel: true, trend: true,
      },
    });
    if (!athlete) return NextResponse.json({ error: "Athlète introuvable" }, { status: 404 });
    return NextResponse.json(athlete);
  } catch (error) {
    console.error("GET /api/athletes/:id error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "athletes", athleteIdSource: "params", athleteIdKey: "id" });

// PATCH /api/athletes/:id
export const PATCH = withAthleteAccess(async (request, ctx, routeCtx) => {
  try {
    const { id } = await routeCtx!.params;
    // Only owners can edit athletes
    if (ctx.athleteAccess?.accessType !== "owner") {
      return NextResponse.json({ error: "Seul le professionnel référent peut modifier cet athlète." }, { status: 403 });
    }

    const rawBody = sanitizeBody(await request.json());

    // ─── CRITICAL: Block athlete ownership transfer (anti-absorption) ───
    if ("professionnelId" in rawBody) {
      console.warn(`[ATHLETE] Blocked ownership transfer attempt by pro=${ctx.session.id} athlete=${id}`);
      return NextResponse.json({
        error: "Le transfert de propriété d'un athlète n'est pas autorisé.",
        code: "ATHLETE_TRANSFER_BLOCKED",
      }, { status: 403 });
    }

    const parsed = validateBody(rawBody, updateAthleteSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) data[key] = value;
    }
    // Double safety: never allow professionnelId in update data
    delete data.professionnelId;

    // Special handling for typed fields
    if (body.dateNaissance !== undefined) {
      data.dateNaissance = body.dateNaissance ? new Date(body.dateNaissance) : null;
    }
    if (body.taille !== undefined) {
      data.taille = body.taille ? Number(body.taille) : null;
    }
    if (body.poids !== undefined) {
      data.poids = body.poids ? Number(body.poids) : null;
    }
    // ─── Consent traceability: log consent changes through ConsentLog ───
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = request.headers.get("user-agent") || null;
    const consentCtx = { ip, userAgent, method: "digital" as const };

    if (body.consentement !== undefined) {
      if (body.consentement) {
        await consent.grant("general", id, ctx.session.id, { ...consentCtx, purpose: "Consentement général au traitement des données" });
      } else {
        await consent.revoke("general", id, ctx.session.id, consentCtx);
      }
      // Remove from data — consent.grant/revoke already updated the fields
      delete data.consentement;
      delete data.consentementDate;
    }

    if (body.consentementPartage !== undefined) {
      if (body.consentementPartage) {
        await consent.grant("partage", id, ctx.session.id, { ...consentCtx, purpose: "Partage de données avec d'autres professionnels" });
      } else {
        await consent.revoke("partage", id, ctx.session.id, consentCtx);
      }
      delete data.consentementPartage;
      delete data.consentementPartageDate;
    }

    // Only update remaining fields if any
    let updated;
    if (Object.keys(data).length > 0) {
      updated = await prisma.athlete.update({ where: { id }, data });
    } else {
      updated = await prisma.athlete.findUnique({ where: { id } });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/athletes/:id error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "athletes", athleteIdSource: "params", athleteIdKey: "id" });
