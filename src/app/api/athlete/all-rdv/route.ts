import { NextRequest, NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/athlete/all-rdv?status=upcoming|past|cancelled&proId=...&specialite=...&period=...&motif=...
// Returns all appointments with full details, documents, and filtering

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.search);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status"); // upcoming | past | cancelled | all
    const proIdFilter = searchParams.get("proId");
    const specialiteFilter = searchParams.get("specialite");
    const periodFilter = searchParams.get("period"); // 7d | 30d | 90d | 6m | 1y | all
    const motifFilter = searchParams.get("motif");

    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id, status: "accepted" },
      select: { professionnelId: true },
    });
    if (connections.length === 0) {
      return NextResponse.json({ appointments: [], pros: [], stats: { total: 0, upcoming: 0, past: 0, cancelled: 0 } });
    }

    let proIds = connections.map((c: any) => c.professionnelId);

    // Filter by specific pro
    if (proIdFilter) {
      proIds = proIds.filter((id: string) => id === proIdFilter);
    }

    const athletes = await prisma.athlete.findMany({
      where: {
        professionnelId: { in: proIds },
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true, professionnelId: true },
    });

    const athleteIds = athletes.map((a: any) => a.id);
    if (athleteIds.length === 0) {
      return NextResponse.json({ appointments: [], pros: [], stats: { total: 0, upcoming: 0, past: 0, cancelled: 0 } });
    }

    // Build date filter
    const now = new Date();
    let dateFrom: Date | undefined;
    if (periodFilter && periodFilter !== "all") {
      const periodMap: Record<string, number> = {
        "7d": 7, "30d": 30, "90d": 90, "6m": 180, "1y": 365,
      };
      const days = periodMap[periodFilter];
      if (days) {
        dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      }
    }

    // Build where clause based on status
    const baseWhere: any = {
      athleteId: { in: athleteIds },
      type: "rdv",
    };

    if (dateFrom) {
      baseWhere.date = { gte: dateFrom };
    }

    // Filter by specialite
    if (specialiteFilter) {
      const prosWithSpec = await prisma.professionnel.findMany({
        where: { id: { in: proIds }, specialite: { contains: specialiteFilter, mode: "insensitive" } },
        select: { id: true },
      });
      const specProIds = prosWithSpec.map((p: any) => p.id);
      // Re-filter athletes
      const specAthletes = athletes.filter((a: any) => specProIds.includes(a.professionnelId));
      baseWhere.athleteId = { in: specAthletes.map((a: any) => a.id) };
    }

    let whereClause: any;
    if (statusFilter === "upcoming") {
      whereClause = { ...baseWhere, deletedAt: null, date: { ...baseWhere.date, gte: now } };
    } else if (statusFilter === "past") {
      whereClause = { ...baseWhere, deletedAt: null, date: { ...baseWhere.date, lt: now } };
    } else if (statusFilter === "cancelled") {
      whereClause = { ...baseWhere, deletedAt: { not: null } };
    } else {
      // all
      whereClause = { ...baseWhere };
    }

    const events = await prisma.calendarEvent.findMany({
      where: whereClause,
      orderBy: { date: "desc" },
      take: 100,
      include: {
        professionnel: {
          select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true, adresseCabinet: true, telephone: true },
        },
      },
    });

    // Fetch associated documents
    let docs: any[] = [];
    try {
      docs = await prisma.sharedDocument.findMany({
        where: { receiverAthleteId: { in: athleteIds }, deletedAt: null },
        select: { id: true, originalName: true, category: true, note: true, senderProId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
    } catch { /* silent */ }

    let ordonnances: any[] = [];
    try {
      ordonnances = await prisma.medOrdonnance.findMany({
        where: { athleteId: { in: athleteIds }, deletedAt: null, status: { in: ["signee", "transmise"] } },
        select: { id: true, type: true, diagnosis: true, pdfUrl: true, proId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
    } catch { /* silent */ }

    const mapped = events
      .map((a: any) => {
        const descLines = (a.description || "").split("\n");
        const formatLine = descLines.find((l: string) => l.toLowerCase().startsWith("format"));
        const format = formatLine?.includes("éléconsultation") ? "teleconsultation" : "presentiel";
        const motifLine = descLines.find((l: string) => l.toLowerCase().startsWith("motif"));
        const motif = motifLine ? motifLine.replace(/^motif\s*:\s*/i, "").trim() : null;

        // Status
        let status: "upcoming" | "past" | "cancelled" = "upcoming";
        if (a.deletedAt) {
          status = "cancelled";
        } else if (new Date(a.date) < now) {
          status = "past";
        }

        // Related documents (within 2 days of the event)
        const eventDate = new Date(a.date);
        const dayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
        const dayAfter = new Date(eventDate.getTime() + 48 * 60 * 60 * 1000);

        const relatedDocs = docs
          .filter((d: any) => d.senderProId === a.professionnelId && new Date(d.createdAt) >= dayBefore && new Date(d.createdAt) <= dayAfter)
          .map((d: any) => ({ id: d.id, name: d.originalName, category: d.category }));

        const relatedOrds = ordonnances
          .filter((o: any) => o.proId === a.professionnelId && new Date(o.createdAt) >= dayBefore && new Date(o.createdAt) <= dayAfter)
          .map((o: any) => ({ id: o.id, type: o.type, diagnosis: o.diagnosis }));

        return {
          id: a.id,
          title: a.title,
          date: a.date,
          endDate: a.endDate,
          format,
          motif,
          status,
          cancelledAt: a.deletedAt,
          visioRoomId: a.visioRoomId || null,
          documents: relatedDocs,
          ordonnances: relatedOrds,
          pro: {
            id: a.professionnel.id,
            nom: a.professionnel.nom,
            prenom: a.professionnel.prenom,
            specialite: a.professionnel.specialite,
          },
        };
      })
      .filter((a: any) => {
        if (motifFilter && a.motif) {
          return a.motif.toLowerCase().includes(motifFilter.toLowerCase());
        }
        return true;
      });

    // Build unique pros list for filter dropdown
    const prosMap = new Map<string, any>();
    for (const ev of events) {
      if (!prosMap.has(ev.professionnel.id)) {
        prosMap.set(ev.professionnel.id, {
          id: ev.professionnel.id,
          nom: ev.professionnel.nom,
          prenom: ev.professionnel.prenom,
          specialite: ev.professionnel.specialite,
        });
      }
    }

    // Stats
    const stats = {
      total: mapped.length,
      upcoming: mapped.filter((a: any) => a.status === "upcoming").length,
      past: mapped.filter((a: any) => a.status === "past").length,
      cancelled: mapped.filter((a: any) => a.status === "cancelled").length,
    };

    return NextResponse.json({
      appointments: mapped,
      pros: Array.from(prosMap.values()),
      stats,
    });
  } catch (error) {
    console.error("GET /api/athlete/all-rdv error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
