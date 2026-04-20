import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { applyRateLimit, getIP, RATE_LIMITS } from "@/lib/rateLimit";
import { signAvatarUrl } from "@/lib/signedUrl";

const MAX_RESULTS = 20;

export async function GET(request: NextRequest) {
  // ── Rate limit ──
  const ip = getIP(request);
  const limited = applyRateLimit(`search-pros:${ip}`, RATE_LIMITS.search);
  if (limited) return limited;

  // ── Auth ──
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // Per-user rate limit (anti-scraping)
  const userLimited = applyRateLimit(`search-pros:user:${session.id}`, RATE_LIMITS.search);
  if (userLimited) return userLimited;

  // ── Query params ──
  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const offsetParam = request.nextUrl.searchParams.get("offset");
  const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;

  if (q.length < 3) {
    return NextResponse.json({ results: [], total: 0 });
  }

  try {
    // Normalize phone: remove spaces, dashes, dots, parentheses
    const normalizedPhone = q.replace(/[\s\-().+]/g, "");
    const isPhoneLike = /^\d{6,}$/.test(normalizedPhone);

    // Build OR conditions for multi-criteria search
    const searchConditions: any[] = [
      { nom: { contains: q, mode: "insensitive" } },
      { prenom: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];

    // If query looks like a phone number, also search by normalized phone
    if (isPhoneLike) {
      searchConditions.push({
        telephone: { contains: normalizedPhone, mode: "insensitive" },
      });
    }

    // If query has a space, try "prenom nom" and "nom prenom" combos
    if (q.includes(" ")) {
      const parts = q.split(/\s+/);
      const first = parts[0];
      const rest = parts.slice(1).join(" ");

      searchConditions.push(
        { AND: [{ prenom: { contains: first, mode: "insensitive" } }, { nom: { contains: rest, mode: "insensitive" } }] },
        { AND: [{ nom: { contains: first, mode: "insensitive" } }, { prenom: { contains: rest, mode: "insensitive" } }] },
      );
    }

    // Get IDs of pros who blocked this athlete
    const blockedByPros = await prisma.blockedAthlete.findMany({
      where: { athleteUserId: session.id },
      select: { professionnelId: true },
    });
    const blockedProIds = blockedByPros.map((b: any) => b.professionnelId);

    const where = {
      OR: searchConditions,
      emailVerified: true,
      verificationStatus: "verified",
      searchable: true,
      ...(blockedProIds.length > 0 ? { id: { notIn: blockedProIds } } : {}),
    };

    // Count total for pagination
    const total = await prisma.professionnel.count({ where });

    // Fetch results
    const pros = await prisma.professionnel.findMany({
      where,
      select: {
        id: true,
        nom: true,
        prenom: true,
        specialite: true,
        avatarPath: true,
        adresseCabinet: true,
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
      skip: offset,
      take: MAX_RESULTS,
    });

    // Sign avatar URLs (RGPD: no raw paths)
    const results = pros.map((pro: any) => ({
      id: pro.id,
      nom: pro.nom,
      prenom: pro.prenom,
      specialite: pro.specialite,
      avatarUrl: signAvatarUrl(pro.avatarPath),
      adresseCabinet: pro.adresseCabinet || null,
    }));

    return NextResponse.json({
      results,
      total,
      offset,
      limit: MAX_RESULTS,
      hasMore: offset + results.length < total,
    });
  } catch (error) {
    console.error("[search-pros] Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
