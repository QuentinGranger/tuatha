import { NextResponse } from "next/server";
import { getSessionAthlete } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/athlete/past-rdv
// Returns recent past appointments (last 30 days) with associated documents/ordonnances

export async function GET() {
  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Find accepted connections
    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id, status: "accepted" },
      select: { professionnelId: true },
    });
    if (connections.length === 0) {
      return NextResponse.json({ pastAppointments: [] });
    }

    const proIds = connections.map((c: any) => c.professionnelId);

    // Find Athlete records linked to these pros
    const athletes = await prisma.athlete.findMany({
      where: {
        professionnelId: { in: proIds },
        contactEmail: { equals: athleteUser.email, mode: "insensitive" },
      },
      select: { id: true, professionnelId: true },
    });

    const athleteIds = athletes.map((a: any) => a.id);
    if (athleteIds.length === 0) {
      return NextResponse.json({ pastAppointments: [] });
    }

    // Get past events from last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const pastEvents = await prisma.calendarEvent.findMany({
      where: {
        athleteId: { in: athleteIds },
        type: "rdv",
        date: { gte: thirtyDaysAgo, lt: now },
        deletedAt: null,
      },
      orderBy: { date: "desc" },
      take: 10,
      include: {
        professionnel: {
          select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true, adresseCabinet: true, telephone: true },
        },
      },
    });

    // For each athlete record, fetch recent shared documents and ordonnances
    const athleteIdsByPro = new Map<string, string>();
    for (const a of athletes) {
      athleteIdsByPro.set(a.professionnelId, a.id);
    }

    let docs: any[] = [];
    try {
      docs = await prisma.sharedDocument.findMany({
        where: {
          receiverAthleteId: { in: athleteIds },
          deletedAt: null,
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true,
          originalName: true,
          category: true,
          note: true,
          senderProId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    } catch { /* table might not exist */ }

    let ordonnances: any[] = [];
    try {
      ordonnances = await prisma.medOrdonnance.findMany({
        where: {
          athleteId: { in: athleteIds },
          deletedAt: null,
          status: { in: ["signee", "transmise"] },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          id: true,
          type: true,
          diagnosis: true,
          pdfUrl: true,
          proId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    } catch { /* table might not exist */ }

    const mapped = pastEvents.map((a: any) => {
      const descLines = (a.description || "").split("\n");
      const formatLine = descLines.find((l: string) => l.toLowerCase().startsWith("format"));
      const format = formatLine?.includes("éléconsultation") ? "teleconsultation" : "presentiel";
      const motifLine = descLines.find((l: string) => l.toLowerCase().startsWith("motif"));
      const motif = motifLine ? motifLine.replace(/^motif\s*:\s*/i, "").trim() : null;

      // Documents from this pro sent around this appointment date
      const eventDate = new Date(a.date);
      const dayBefore = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);
      const dayAfter = new Date(eventDate.getTime() + 48 * 60 * 60 * 1000);

      const relatedDocs = docs
        .filter((d: any) => d.senderProId === a.professionnelId && new Date(d.createdAt) >= dayBefore && new Date(d.createdAt) <= dayAfter)
        .map((d: any) => ({
          id: d.id,
          name: d.originalName,
          category: d.category,
          note: d.note,
        }));

      const relatedOrdonnances = ordonnances
        .filter((o: any) => o.proId === a.professionnelId && new Date(o.createdAt) >= dayBefore && new Date(o.createdAt) <= dayAfter)
        .map((o: any) => ({
          id: o.id,
          type: o.type,
          diagnosis: o.diagnosis,
          pdfUrl: o.pdfUrl,
        }));

      // Suggest follow-up intervals based on motif/specialite
      const followUpSuggestions = getFollowUpSuggestions(motif, a.professionnel.specialite);

      return {
        id: a.id,
        title: a.title,
        date: a.date,
        endDate: a.endDate,
        description: a.description,
        format,
        motif,
        documents: relatedDocs,
        ordonnances: relatedOrdonnances,
        followUpSuggestions,
        pro: {
          id: a.professionnel.id,
          nom: a.professionnel.nom,
          prenom: a.professionnel.prenom,
          specialite: a.professionnel.specialite,
        },
      };
    });

    return NextResponse.json({ pastAppointments: mapped });
  } catch (error) {
    console.error("GET /api/athlete/past-rdv error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

function getFollowUpSuggestions(motif: string | null, specialite: string): { label: string; days: number }[] {
  const m = (motif || "").toLowerCase();
  const s = specialite.toLowerCase();

  // Kine: frequent follow-ups
  if (s.includes("kine")) {
    if (m.includes("reeducation") || m.includes("rééducation")) {
      return [
        { label: "Dans 3 jours", days: 3 },
        { label: "Dans 1 semaine", days: 7 },
        { label: "Dans 2 semaines", days: 14 },
      ];
    }
    return [
      { label: "Dans 1 semaine", days: 7 },
      { label: "Dans 2 semaines", days: 14 },
      { label: "Dans 1 mois", days: 30 },
    ];
  }

  // Autre professionnel / Coach: regular sessions
  if (s.includes("autre") || s.includes("coach")) {
    return [
      { label: "Dans 3 jours", days: 3 },
      { label: "Dans 1 semaine", days: 7 },
      { label: "Dans 2 semaines", days: 14 },
    ];
  }

  // Diététicien / Nutri: bi-weekly or monthly
  if (s.includes("dieteticien") || s.includes("nutri")) {
    return [
      { label: "Dans 2 semaines", days: 14 },
      { label: "Dans 1 mois", days: 30 },
      { label: "Dans 2 mois", days: 60 },
    ];
  }

  // Default (medecin, etc.)
  if (m.includes("suivi")) {
    return [
      { label: "Dans 1 semaine", days: 7 },
      { label: "Dans 15 jours", days: 15 },
      { label: "Dans 1 mois", days: 30 },
    ];
  }

  return [
    { label: "Dans 7 jours", days: 7 },
    { label: "Dans 15 jours", days: 15 },
    { label: "Dans 1 mois", days: 30 },
  ];
}
