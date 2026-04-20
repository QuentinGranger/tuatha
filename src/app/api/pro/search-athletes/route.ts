import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { signAvatarUrl } from "@/lib/signedUrl";
import { getPrivacySettingsBatch } from "@/lib/privacyGuard";

const MAX_RESULTS = 15;

// GET /api/pro/search-athletes?q=...
export async function GET(request: NextRequest) {
  // Rate limit
  const ip = getIP(request);
  const limited = applyRateLimit(`search-athletes:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  // Auth
  const session = await getSessionPro();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const userLimited = applyRateLimit(`search-athletes:user:${session.id}`, RATE_LIMITS.search);
  if (userLimited) return userLimited;

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // Build search conditions
    const searchConditions: any[] = [
      { nom: { contains: q, mode: "insensitive" } },
      { prenom: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];

    // "prenom nom" / "nom prenom" combo
    if (q.includes(" ")) {
      const parts = q.split(/\s+/);
      const first = parts[0];
      const rest = parts.slice(1).join(" ");
      searchConditions.push(
        { AND: [{ prenom: { contains: first, mode: "insensitive" } }, { nom: { contains: rest, mode: "insensitive" } }] },
        { AND: [{ nom: { contains: first, mode: "insensitive" } }, { prenom: { contains: rest, mode: "insensitive" } }] },
      );
    }

    // Get blocked athlete IDs
    const blockedAthletes = await (prisma as any).blockedAthlete.findMany({
      where: { professionnelId: session.id },
      select: { athleteUserId: true },
    });
    const blockedIds = blockedAthletes.map((b: any) => b.athleteUserId);

    const where = {
      OR: searchConditions,
      emailVerified: true,
      ...(blockedIds.length > 0 ? { id: { notIn: blockedIds } } : {}),
    };

    const athletes = await (prisma as any).athleteUser.findMany({
      where,
      select: {
        id: true,
        nom: true,
        prenom: true,
        sport: true,
        avatarPath: true,
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      take: MAX_RESULTS,
    });

    // Check connection status for each athlete
    const athleteIds = athletes.map((a: any) => a.id);
    const connections = await (prisma as any).connectionRequest.findMany({
      where: {
        professionnelId: session.id,
        athleteUserId: { in: athleteIds },
      },
      select: { athleteUserId: true, status: true },
    });
    const connectionMap = new Map(connections.map((c: any) => [c.athleteUserId, c.status]));

    // ── Privacy enforcement: respect athlete privacy for connected athletes ──
    const connectedIds = athletes
      .filter((a: any) => connectionMap.get(a.id) === "accepted")
      .map((a: any) => a.id as string);
    const privacyMap = await getPrivacySettingsBatch(connectedIds, session.id);

    const results = athletes.map((a: any) => {
      const privacy = privacyMap.get(a.id);
      return {
        id: a.id,
        nom: a.nom,
        prenom: a.prenom,
        sport: privacy && !privacy.shareSport ? null : (a.sport || null),
        avatarUrl: privacy && !privacy.sharePhoto ? null : signAvatarUrl(a.avatarPath),
        connectionStatus: connectionMap.get(a.id) || null,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[search-athletes] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
