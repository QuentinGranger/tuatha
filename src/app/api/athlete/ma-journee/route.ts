import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { signAvatarUrl } from "@/lib/signedUrl";

export const dynamic = "force-dynamic";

// GET /api/athlete/ma-journee
// Aggregates today's appointments, active kine plans (exercises), active nutri plans (meals),
// and active med plans (restrictions, conduite) from all connected pros.

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, RATE_LIMITS.read);
  if (limited) return limited;

  const session = await getSessionAthlete();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const athleteUser = await prisma.athleteUser.findUnique({
      where: { id: session.id },
      select: { email: true, prenom: true, nom: true },
    });
    if (!athleteUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // ── Accepted connections ──
    const connections = await prisma.connectionRequest.findMany({
      where: { athleteUserId: session.id, status: "accepted" },
      select: {
        professionnelId: true,
        professionnel: {
          select: {
            id: true, nom: true, prenom: true, specialite: true, avatarPath: true,
          },
        },
      },
    });

    const proIds = connections.map((c) => c.professionnelId);
    const proMap = new Map(
      connections.map((c) => [
        c.professionnelId,
        {
          id: c.professionnel.id,
          nom: c.professionnel.nom,
          prenom: c.professionnel.prenom,
          specialite: c.professionnel.specialite,
          avatarUrl: signAvatarUrl(c.professionnel.avatarPath),
        },
      ])
    );

    // ── Athlete records (per pro) ──
    let athleteIds: string[] = [];
    let athleteProMap = new Map<string, string>(); // athleteId → proId
    if (proIds.length > 0) {
      const athletes = await prisma.athlete.findMany({
        where: {
          professionnelId: { in: proIds },
          contactEmail: { equals: athleteUser.email, mode: "insensitive" },
        },
        select: { id: true, professionnelId: true },
      });
      athleteIds = athletes.map((a) => a.id);
      for (const a of athletes) {
        athleteProMap.set(a.id, a.professionnelId);
      }
    }

    // ── Today's appointments ──
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const orConditions: any[] = [{ athleteUserId: session.id }];
    if (athleteIds.length > 0) {
      orConditions.push({ athleteId: { in: athleteIds } });
    }

    const todayAppointments = await prisma.calendarEvent.findMany({
      where: {
        OR: orConditions,
        type: "rdv",
        date: { gte: todayStart, lt: todayEnd },
        deletedAt: null,
      },
      orderBy: { date: "asc" },
      include: {
        professionnel: {
          select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true, adresseCabinet: true },
        },
      },
    });

    const appointments = todayAppointments.map((a: any) => {
      const descLines = (a.description || "").split("\n");
      const formatLine = descLines.find((l: string) => l.toLowerCase().startsWith("format"));
      const format = formatLine?.includes("éléconsultation") ? "teleconsultation" : "presentiel";
      return {
        id: a.id,
        title: a.title,
        date: a.date,
        endDate: a.endDate,
        format,
        visioRoomId: a.visioRoomId || null,
        pro: a.professionnel ? {
          id: a.professionnel.id,
          nom: a.professionnel.nom,
          prenom: a.professionnel.prenom,
          specialite: a.professionnel.specialite,
          avatarUrl: signAvatarUrl(a.professionnel.avatarPath),
          adresseCabinet: a.professionnel.adresseCabinet || null,
        } : null,
      };
    });

    // ── Next upcoming appointment (today or future) ──
    const nextAppointmentRaw = await prisma.calendarEvent.findFirst({
      where: {
        OR: orConditions,
        type: "rdv",
        date: { gte: now },
        deletedAt: null,
      },
      orderBy: { date: "asc" },
      include: {
        professionnel: {
          select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true, adresseCabinet: true },
        },
      },
    });

    let nextAppointment = null;
    if (nextAppointmentRaw) {
      const a = nextAppointmentRaw as any;
      const descLines = (a.description || "").split("\n");
      const formatLine = descLines.find((l: string) => l.toLowerCase().startsWith("format"));
      const format = formatLine?.includes("éléconsultation") ? "teleconsultation" : "presentiel";
      nextAppointment = {
        id: a.id,
        title: a.title,
        date: a.date,
        endDate: a.endDate,
        format,
        visioRoomId: a.visioRoomId || null,
        pro: a.professionnel ? {
          id: a.professionnel.id,
          nom: a.professionnel.nom,
          prenom: a.professionnel.prenom,
          specialite: a.professionnel.specialite,
          avatarUrl: signAvatarUrl(a.professionnel.avatarPath),
          adresseCabinet: a.professionnel.adresseCabinet || null,
        } : null,
      };
    }

    // ── Active kine plans with exercises ──
    let kinePlans: any[] = [];
    if (athleteIds.length > 0) {
      const plans = await (prisma as any).kinePlan.findMany({
        where: {
          athleteId: { in: athleteIds },
          isTemplate: false,
          status: "active",
          deletedAt: null,
        },
        include: {
          exercises: {
            include: {
              video: {
                select: { id: true, title: true, url: true, thumbnail: true, category: true, duration: true },
              },
            },
            orderBy: { position: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      kinePlans = plans.map((p: any) => {
        const proId = p.professionnelId;
        const pro = proMap.get(proId);
        return {
          id: p.id,
          title: p.title,
          objective: p.objective,
          frequency: p.frequency,
          notesPatient: p.notesPatient,
          progress: p.globalProgress || 0,
          proName: pro ? `${pro.prenom} ${pro.nom}` : null,
          proSpecialite: pro?.specialite || null,
          exercises: p.exercises.map((ex: any) => ({
            id: ex.id,
            sets: ex.sets,
            reps: ex.reps,
            duration: ex.duration,
            rest: ex.rest,
            consignes: ex.consignes,
            equipment: ex.equipment,
            video: ex.video ? {
              title: ex.video.title,
              thumbnail: ex.video.thumbnail,
              category: ex.video.category,
            } : null,
          })),
        };
      });
    }

    // ── Active nutri plans with today's meals ──
    let nutriPlans: any[] = [];
    if (athleteIds.length > 0) {
      const plans = await (prisma as any).nutriPlan.findMany({
        where: {
          athleteId: { in: athleteIds },
          status: { in: ["publie", "en_cours"] },
          deletedAt: null,
        },
        include: {
          meals: {
            orderBy: { position: "asc" },
            include: {
              items: {
                orderBy: { position: "asc" },
                select: { id: true, name: true, quantity: true, unit: true, kcal: true, protein: true, carbs: true, fat: true, category: true, mandatory: true },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      nutriPlans = plans.map((p: any) => {
        const proId = p.proId;
        const pro = proMap.get(proId);
        return {
          id: p.id,
          name: p.name,
          kcalTarget: p.kcalTarget,
          proteinTarget: p.proteinTarget,
          carbsTarget: p.carbsTarget,
          fatTarget: p.fatTarget,
          waterTarget: p.waterTarget,
          notePatient: p.notePatient || null,
          proName: pro ? `${pro.prenom} ${pro.nom}` : null,
          proSpecialite: pro?.specialite || null,
          meals: p.meals.map((m: any) => ({
            id: m.id,
            name: m.name,
            time: m.time,
            rule: m.rule,
            items: m.items,
          })),
        };
      });
    }

    // ── Nutri tracking (consumed items for today) ──
    const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const trackingLogs = await (prisma as any).nutriDayLog.findMany({
      where: {
        athleteUserId: session.id,
        date: todayDateOnly,
        consumed: true,
      },
      select: { mealItemId: true },
    });
    const consumedItemIds: string[] = trackingLogs.map((l: any) => l.mealItemId);

    // ── Custom food entries for today ──
    const customEntries = await (prisma as any).nutriCustomEntry.findMany({
      where: {
        athleteUserId: session.id,
        date: todayDateOnly,
      },
      orderBy: { createdAt: "asc" },
    });

    // ── Active med plans ──
    let medPlans: any[] = [];
    if (athleteIds.length > 0) {
      const plans = await (prisma as any).medPlan.findMany({
        where: { athleteId: { in: athleteIds } },
        orderBy: { updatedAt: "desc" },
      });

      medPlans = plans.map((p: any) => {
        const proId = p.proId;
        const pro = proMap.get(proId);
        return {
          id: p.id,
          episode: p.episode,
          patientStatus: p.patientStatus,
          conduite: JSON.parse(p.conduiteJson || "[]"),
          restrictions: JSON.parse(p.restrictionsJson || "[]"),
          nextSteps: JSON.parse(p.nextStepsJson || "[]"),
          proName: pro ? `${pro.prenom} ${pro.nom}` : null,
          proSpecialite: pro?.specialite || null,
          updatedAt: p.updatedAt,
        };
      });
    }

    return NextResponse.json({
      prenom: athleteUser.prenom,
      todayAppointments: appointments,
      nextAppointment,
      kinePlans,
      nutriPlans,
      consumedItemIds,
      customEntries: customEntries.map((e: any) => ({
        id: e.id,
        nutriMealId: e.nutriMealId,
        name: e.name,
        quantity: e.quantity,
        unit: e.unit,
        kcal: e.kcal,
        protein: e.protein,
        carbs: e.carbs,
        fat: e.fat,
      })),
      medPlans,
    });
  } catch (error) {
    console.error("GET /api/athlete/ma-journee error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
