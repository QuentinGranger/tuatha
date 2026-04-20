import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createAthleteSchema } from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { sanitizeBody } from "@/lib/sanitize";
import { consent } from "@/lib/consent";
import { ATHLETE_LIST_SELECT } from "@/lib/dataMinimization";
import { signAvatarUrl } from "@/lib/signedUrl";
import { getPrivacySettingsBatch, applyPrivacyFilter, logAccess } from "@/lib/privacyGuard";

// GET /api/athletes?status=active&search=...
export const GET = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;
    const limited = applyRateLimit(`search:${pro.id}`, RATE_LIMITS.search);
    if (limited) return limited;

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    // Get IDs of athletes shared with me via ProConnection
    const sharedConnections = await (prisma as any).proConnection.findMany({
      where: { connectedProId: pro.id, status: "connecte" },
      select: { athleteId: true },
    });
    const sharedAthleteIds: string[] = sharedConnections.map((c: any) => c.athleteId);

    const baseOr: Record<string, unknown>[] = [
      { professionnelId: pro.id },
    ];
    if (sharedAthleteIds.length > 0) {
      baseOr.push({ id: { in: sharedAthleteIds } });
    }

    const where: Record<string, unknown> = { OR: baseOr };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.AND = [
        {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { sport: { contains: search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const athletes = await prisma.athlete.findMany({
      where: where as any,
      orderBy: { updatedAt: "desc" },
      select: ATHLETE_LIST_SELECT,
    });

    // Deduplicate: if a shared athlete has the same name (case-insensitive) as one of
    // my own athletes, keep only my own record to avoid showing two profiles for the
    // same person. The shared data is still accessible via the Réseau page.
    const myNames = new Set<string>();
    const myAthletes: any[] = [];
    const sharedOnly: any[] = [];
    for (const a of athletes) {
      if (a.professionnelId === pro.id) {
        myNames.add(a.name.trim().toLowerCase());
        myAthletes.push(a);
      } else {
        sharedOnly.push(a);
      }
    }
    // Only add shared athletes whose name doesn't already exist in my own list
    for (const a of sharedOnly) {
      if (!myNames.has(a.name.trim().toLowerCase())) {
        myAthletes.push(a);
      }
    }

    // ── Merge connected AthleteUser (self-registered athletes with accepted connection) ──
    const connectedAthleteUsers = await (prisma as any).connectionRequest.findMany({
      where: { professionnelId: pro.id, status: "accepted" },
      include: {
        athleteUser: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            sport: true,
            objectif: true,
            dateNaissance: true,
            taille: true,
            poids: true,
            antecedents: true,
            traitements: true,
            contreIndications: true,
            avatarPath: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    for (const conn of connectedAthleteUsers) {
      const au = conn.athleteUser;
      if (!au) continue;
      const fullName = `${au.prenom} ${au.nom}`;
      const nameLower = fullName.trim().toLowerCase();

      // Skip if already exists as a manual Athlete record
      if (myNames.has(nameLower)) continue;

      // Apply search filter if present
      if (search) {
        const q = search.toLowerCase();
        const matchesName = nameLower.includes(q);
        const matchesSport = au.sport?.toLowerCase().includes(q);
        if (!matchesName && !matchesSport) continue;
      }

      // Skip if status filter is set and doesn't match "active" (connected = active)
      if (status && status !== "active") continue;

      myNames.add(nameLower);
      myAthletes.push({
        id: au.id,
        name: fullName,
        sport: au.sport || null,
        status: "active",
        riskLevel: "GOOD",
        trend: "STAGNATING",
        lastContactAt: conn.respondedAt || conn.createdAt,
        objectif: au.objectif || null,
        motif: null,
        bodyZone: null,
        consentement: true,
        professionnelId: pro.id,
        createdAt: conn.createdAt,
        updatedAt: au.updatedAt,
        avatarUrl: signAvatarUrl(au.avatarPath),
        _count: { notes: 0 },
        _source: "athlete_user",
        _athleteUserId: au.id,
      });
    }

    // ── Privacy enforcement: filter connected AthleteUser data ──
    const athleteUserIds = myAthletes
      .filter((a: any) => a._source === "athlete_user" && a._athleteUserId)
      .map((a: any) => a._athleteUserId as string);

    const privacyMap = await getPrivacySettingsBatch(athleteUserIds, pro.id);

    const filtered = myAthletes.map((a: any) => {
      if (a._source === "athlete_user" && a._athleteUserId) {
        logAccess(a._athleteUserId, pro.id, "view_list");
        const settings = privacyMap.get(a._athleteUserId);
        if (settings) return applyPrivacyFilter(a, settings);
      }
      return a;
    });

    // Sort merged list by updatedAt desc
    filtered.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("GET /api/athletes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "athletes" });

// POST /api/athletes
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), createAthleteSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const athlete = await prisma.athlete.create({
      data: {
        name: d.name,
        sport: d.sport || null,
        injuryNote: d.injuryNote || null,
        professionnelId: pro.id,
        objectif: d.objectif || null,
        motif: d.motif || null,
        contactEmail: d.contactEmail || null,
        contactPhone: d.contactPhone || null,
        consentement: d.consentement,
        consentementDate: d.consentement ? new Date() : null,
        dateNaissance: d.dateNaissance ? new Date(d.dateNaissance) : null,
        taille: d.taille ? Number(d.taille) : null,
        poids: d.poids ? Number(d.poids) : null,
        bodyZone: d.bodyZone || null,
        frequence: d.frequence || null,
        antecedents: d.antecedents,
        traitements: d.traitements || null,
        contreIndications: d.contreIndications || null,
        dataTracking: d.dataTracking,
        canalCommunication: d.canalCommunication || null,
      },
    });

    // Consent traceability: log initial consent if granted at creation
    if (d.consentement) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      const userAgent = request.headers.get("user-agent") || null;
      consent.grant("general", athlete.id, pro.id, {
        ip, userAgent, method: "digital",
        purpose: "Consentement général recueilli à la création du profil",
      }).catch(() => {});
    }

    return NextResponse.json(athlete, { status: 201 });
  } catch (error) {
    console.error("POST /api/athletes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "athletes" });
