import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

// GET /api/athlete/notifications — unread messages from pros
export async function GET() {
  const session = await getSessionAthlete();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    // Unread pro→athlete messages grouped by pro
    const unreadMessages = await prisma.athleteProMessage.findMany({
      where: { athleteUserId: session.id, senderType: "pro", read: false },
      include: {
        professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byPro = new Map<string, { pro: any; count: number; lastMsg: any }>();
    for (const msg of unreadMessages) {
      const key = msg.professionnelId;
      if (!byPro.has(key)) {
        byPro.set(key, { pro: msg.professionnel, count: 1, lastMsg: msg });
      } else {
        byPro.get(key)!.count++;
      }
    }

    const notifications = Array.from(byPro.values()).map((g) => ({
      id: `msg-${g.pro.id}`,
      title: `${g.pro.prenom} ${g.pro.nom}`,
      subtitle: g.count === 1 ? g.lastMsg.content : `${g.count} nouveaux messages`,
      date: g.lastMsg.createdAt,
      type: "message",
      color: "orange",
      source: "pro_message",
      meta: {
        proId: g.pro.id,
        senderName: `${g.pro.prenom} ${g.pro.nom}`,
        senderSpecialite: g.pro.specialite,
        avatarPath: signAvatarUrl(g.pro.avatarPath),
        preview: g.lastMsg.content,
        count: g.count,
      },
    }));

    // Unread group messages from pros
    let groupMessageNotifs: any[] = [];
    try {
      const athleteGroups = await (prisma as any).athleteGroupConversation.findMany({
        where: { athleteUserId: session.id },
        select: { id: true, name: true },
      });
      if (athleteGroups.length > 0) {
        const groupIds = athleteGroups.map((g: any) => g.id);
        const groupNameMap = new Map(athleteGroups.map((g: any) => [g.id, g.name]));

        const unreadGroupMsgs = await (prisma as any).athleteGroupMessage.findMany({
          where: {
            conversationId: { in: groupIds },
            senderType: "pro",
            read: false,
          },
          orderBy: { createdAt: "desc" },
        });

        const byGroup = new Map<string, { count: number; lastMsg: any }>();
        for (const msg of unreadGroupMsgs) {
          const key = msg.conversationId;
          if (!byGroup.has(key)) {
            byGroup.set(key, { count: 1, lastMsg: msg });
          } else {
            byGroup.get(key)!.count++;
          }
        }

        groupMessageNotifs = Array.from(byGroup.entries()).map(([convId, g]) => ({
          id: `group-msg-${convId}`,
          title: `Nouveau message de groupe`,
          subtitle: g.count === 1
            ? (g.lastMsg.content?.slice(0, 80) || "Pièce jointe")
            : `${g.count} nouveaux messages`,
          date: g.lastMsg.createdAt,
          type: "group_message",
          color: "orange",
          source: "group_message",
          meta: {
            conversationId: convId,
            groupName: groupNameMap.get(convId) || "Groupe",
            preview: g.lastMsg.content?.slice(0, 120) || "",
            count: g.count,
          },
        }));
      }
    } catch (_) { /* silent */ }

    // Health sync notifications (recent success or error)
    let healthSyncNotifs: any[] = [];
    try {
      const healthConnections = await prisma.healthAppConnection.findMany({
        where: { athleteUserId: session.id, status: "connected" },
        select: { id: true, provider: true, lastSyncAt: true, lastSyncError: true, updatedAt: true },
      });

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sevenDaysAgoHS = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      for (const conn of healthConnections) {
        if (conn.lastSyncError) {
          // Sync failed — show if updated in last 7 days
          if (conn.updatedAt >= sevenDaysAgoHS) {
            healthSyncNotifs.push({
              id: `health-sync-err-${conn.id}`,
              title: `Sync ${conn.provider} échouée`,
              subtitle: conn.lastSyncError.slice(0, 100),
              date: conn.updatedAt,
              type: "health_sync_error",
              color: "red",
              source: "health_sync",
              meta: {
                connectionId: conn.id,
                provider: conn.provider,
                error: conn.lastSyncError,
              },
            });
          }
        } else if (conn.lastSyncAt && conn.lastSyncAt >= oneDayAgo) {
          // Successful sync in last 24h
          healthSyncNotifs.push({
            id: `health-sync-ok-${conn.id}`,
            title: `Sync ${conn.provider} réussie`,
            subtitle: `Données mises à jour`,
            date: conn.lastSyncAt,
            type: "health_sync_success",
            color: "green",
            source: "health_sync",
            meta: {
              connectionId: conn.id,
              provider: conn.provider,
            },
          });
        }
      }
    } catch (_) { /* silent */ }

    // Pending connection requests initiated by pros
    let connectionNotifs: any[] = [];
    try {
      const pendingRequests = await prisma.connectionRequest.findMany({
        where: { athleteUserId: session.id, status: "pending", requestedBy: "pro" },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const specialiteLabels: Record<string, string> = {
        kine: "Kinésithérapeute",
        medecin: "Médecin",
        coach: "Coach sportif",
        nutri: "Nutritionniste",
      };

      connectionNotifs = pendingRequests.map((c: any) => ({
        id: `conn-${c.id}`,
        title: `${c.professionnel.prenom} ${c.professionnel.nom} souhaite vous suivre`,
        subtitle: specialiteLabels[c.professionnel.specialite] || c.professionnel.specialite || "Professionnel de santé",
        date: c.createdAt,
        type: "connection_request",
        color: "green",
        source: "connection",
        meta: {
          requestId: c.id,
          proId: c.professionnel.id,
          proName: `${c.professionnel.prenom} ${c.professionnel.nom}`,
          proSpecialite: c.professionnel.specialite,
          avatarPath: signAvatarUrl(c.professionnel.avatarPath),
        },
      }));
    } catch (_) { /* connectionRequest table might not exist yet */ }

    // Accepted connection requests (athlete requested, pro accepted recently)
    let connectionAcceptedNotifs: any[] = [];
    try {
      const sevenDaysAgoCR = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const acceptedRequests = await prisma.connectionRequest.findMany({
        where: {
          athleteUserId: session.id,
          status: "accepted",
          requestedBy: "athlete",
          respondedAt: { gte: sevenDaysAgoCR },
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { respondedAt: "desc" },
      });

      const specialiteLabelsAcc: Record<string, string> = {
        kine: "Kinésithérapeute",
        medecin: "Médecin",
        coach: "Coach sportif",
        nutri: "Nutritionniste",
        dieteticien: "Diététicien",
      };

      connectionAcceptedNotifs = acceptedRequests.map((c: any) => ({
        id: `conn-accepted-${c.id}`,
        title: `Demande de connexion acceptée`,
        subtitle: `${c.professionnel.prenom} ${c.professionnel.nom} — ${specialiteLabelsAcc[c.professionnel.specialite] || c.professionnel.specialite || "Professionnel de santé"}`,
        date: c.respondedAt || c.createdAt,
        type: "connection_accepted",
        color: "green",
        source: "connection_accepted",
        meta: {
          requestId: c.id,
          proId: c.professionnel.id,
          proName: `${c.professionnel.prenom} ${c.professionnel.nom}`,
          proSpecialite: c.professionnel.specialite,
          avatarPath: signAvatarUrl(c.professionnel.avatarPath),
        },
      }));
    } catch (_) { /* silent */ }

    // Rejected connection requests (athlete requested, pro declined recently)
    let connectionRejectedNotifs: any[] = [];
    try {
      const sevenDaysAgoCRR = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const rejectedRequests = await prisma.connectionRequest.findMany({
        where: {
          athleteUserId: session.id,
          status: "rejected",
          requestedBy: "athlete",
          respondedAt: { gte: sevenDaysAgoCRR },
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { respondedAt: "desc" },
      });

      const specialiteLabelsRej: Record<string, string> = {
        kine: "Kinésithérapeute",
        medecin: "Médecin",
        coach: "Coach sportif",
        nutri: "Nutritionniste",
        dieteticien: "Diététicien",
      };

      connectionRejectedNotifs = rejectedRequests.map((c: any) => ({
        id: `conn-rejected-${c.id}`,
        title: `Demande de connexion déclinée`,
        subtitle: `${c.professionnel.prenom} ${c.professionnel.nom} — ${specialiteLabelsRej[c.professionnel.specialite] || c.professionnel.specialite || "Professionnel de santé"}`,
        date: c.respondedAt || c.createdAt,
        type: "connection_rejected",
        color: "gray",
        source: "connection_rejected",
        meta: {
          requestId: c.id,
          proId: c.professionnel.id,
          proName: `${c.professionnel.prenom} ${c.professionnel.nom}`,
          proSpecialite: c.professionnel.specialite,
          avatarPath: signAvatarUrl(c.professionnel.avatarPath),
        },
      }));
    } catch (_) { /* silent */ }

    // Slot alert notifications (freed slots with in-app reminders)
    let slotAlertNotifs: any[] = [];
    try {
      const slotReminders = await prisma.bookingReminder.findMany({
        where: {
          athleteUserId: session.id,
          type: "slot_freed",
          channel: "inapp",
          dismissed: false,
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      slotAlertNotifs = slotReminders.map((r: any) => ({
        id: `slot-${r.id}`,
        title: `Créneau libéré !`,
        subtitle: `${r.eventDate ? new Date(r.eventDate).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : ""} — ${r.professionnel.prenom} ${r.professionnel.nom}`,
        date: r.createdAt,
        type: "slot_freed",
        color: "green",
        source: "slot_freed",
        meta: {
          reminderId: r.id,
          proId: r.professionnelId,
          proName: `${r.professionnel.prenom} ${r.professionnel.nom}`,
          proSpecialite: r.professionnel.specialite,
          avatarPath: signAvatarUrl(r.professionnel.avatarPath),
          eventDate: r.eventDate,
          eventMotif: r.eventMotif,
        },
      }));
    } catch (_) { /* silent */ }

    // Coach sessions newly planned (planifiée, visible to athlete) + feedback requested
    let sessionNotifs: any[] = [];
    let feedbackRequestedNotifs: any[] = [];
    try {
      const athleteUser = await prisma.athleteUser.findUnique({
        where: { id: session.id },
        select: { email: true },
      });
      if (athleteUser?.email) {
        const connections = await prisma.connectionRequest.findMany({
          where: { athleteUserId: session.id, status: "accepted" },
          select: { professionnelId: true },
        });
        const connectedProIds = connections.map((c) => c.professionnelId);
        if (connectedProIds.length > 0) {
          const athletes = await (prisma as any).athlete.findMany({
            where: {
              professionnelId: { in: connectedProIds },
              contactEmail: { equals: athleteUser.email, mode: "insensitive" },
            },
            select: { id: true, professionnelId: true },
          });
          const athleteIds = athletes.map((a: any) => a.id);
          if (athleteIds.length > 0) {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const plannedSessions = await (prisma as any).session.findMany({
              where: {
                athleteId: { in: athleteIds },
                status: "planifiee",
                visibleAthlete: true,
                deletedAt: null,
                updatedAt: { gte: sevenDaysAgo },
              },
              include: {
                professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
              },
              orderBy: { date: "asc" },
            });

            sessionNotifs = plannedSessions.map((s: any) => {
              const isUpdate = s.createdAt && s.updatedAt && (new Date(s.updatedAt).getTime() - new Date(s.createdAt).getTime() > 60_000);
              return {
              id: `session-${s.id}`,
              title: isUpdate ? `Séance modifiée` : `Nouvelle séance planifiée`,
              subtitle: `${s.name} — ${new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}${s.time ? ` à ${s.time}` : ""}`,
              date: s.updatedAt,
              type: isUpdate ? "session_updated" : "session_planned",
              color: isUpdate ? "amber" : "blue",
              source: "session",
              meta: {
                sessionId: s.id,
                sessionName: s.name,
                sessionDate: s.date,
                sessionTime: s.time,
                proId: s.professionnelId,
                proName: `${s.professionnel.prenom} ${s.professionnel.nom}`,
                proSpecialite: s.professionnel.specialite,
                avatarPath: signAvatarUrl(s.professionnel.avatarPath),
              },
            };
            });

            // Completed sessions awaiting athlete feedback
            const completedSessions = await (prisma as any).session.findMany({
              where: {
                athleteId: { in: athleteIds },
                status: "realisee",
                visibleAthlete: true,
                feedbackAthlete: null,
                deletedAt: null,
                updatedAt: { gte: sevenDaysAgo },
              },
              include: {
                professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
              },
              orderBy: { updatedAt: "desc" },
              take: 10,
            });

            feedbackRequestedNotifs = completedSessions.map((s: any) => ({
              id: `feedback-${s.id}`,
              title: `Feedback demandé`,
              subtitle: `${s.name} — ${new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}${s.time ? ` à ${s.time}` : ""}`,
              date: s.updatedAt,
              type: "feedback_requested",
              color: "violet",
              source: "feedback_requested",
              meta: {
                sessionId: s.id,
                sessionName: s.name,
                sessionDate: s.date,
                sessionTime: s.time,
                proId: s.professionnelId,
                proName: `${s.professionnel.prenom} ${s.professionnel.nom}`,
                proSpecialite: s.professionnel.specialite,
                avatarPath: signAvatarUrl(s.professionnel.avatarPath),
              },
            }));
          }
        }
      }
    } catch (_) { /* silent */ }

    // Pending data access requests from pros
    let dataAccessNotifs: any[] = [];
    try {
      const DATA_KEY_LABELS: Record<string, string> = {
        shareSport: "Sport & Objectif",
        sharePhysical: "Données physiques",
        shareAntecedents: "Antécédents médicaux",
        shareTraitements: "Traitements en cours",
        shareContraindic: "Contre-indications",
        shareVitals: "Constantes vitales",
        shareConsultPrep: "Préparation consultation",
        sharePhoto: "Photo de profil",
        shareMessaging: "Messagerie",
      };

      const pendingAccess = await (prisma as any).dataAccessRequest.findMany({
        where: { athleteUserId: session.id, status: "pending" },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      dataAccessNotifs = pendingAccess.map((r: any) => ({
        id: `dar-${r.id}`,
        title: `${r.professionnel.prenom} ${r.professionnel.nom} demande l'accès`,
        subtitle: DATA_KEY_LABELS[r.dataKey] || r.dataKey,
        date: r.createdAt,
        type: "data_access_request",
        color: "purple",
        source: "data_access_request",
        meta: {
          requestId: r.id,
          proId: r.professionnel.id,
          proName: `${r.professionnel.prenom} ${r.professionnel.nom}`,
          proSpecialite: r.professionnel.specialite,
          avatarPath: signAvatarUrl(r.professionnel.avatarPath),
          dataKey: r.dataKey,
          dataLabel: DATA_KEY_LABELS[r.dataKey] || r.dataKey,
          reason: r.reason,
        },
      }));
    } catch (_) { /* silent */ }

    // RDV cancelled by pro (in-app reminders of type rdv_cancelled_by_pro, last 7 days)
    let cancelledByProNotifs: any[] = [];
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const cancelReminders = await prisma.bookingReminder.findMany({
        where: {
          athleteUserId: session.id,
          type: "rdv_cancelled_by_pro",
          channel: "inapp",
          dismissed: false,
          createdAt: { gte: sevenDaysAgo },
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      cancelledByProNotifs = cancelReminders.map((r: any) => ({
        id: `cancel-pro-${r.id}`,
        title: `Rendez-vous annulé`,
        subtitle: `${r.eventMotif || ""}${r.eventDate ? ` — ${new Date(r.eventDate).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}` : ""}`,
        date: r.createdAt,
        type: "rdv_cancelled_by_pro",
        color: "red",
        source: "rdv_cancelled_by_pro",
        meta: {
          reminderId: r.id,
          proId: r.professionnelId,
          proName: `${r.professionnel.prenom} ${r.professionnel.nom}`,
          proSpecialite: r.professionnel.specialite,
          avatarPath: signAvatarUrl(r.professionnel.avatarPath),
          eventDate: r.eventDate,
          eventTitle: r.eventTitle,
        },
      }));
    } catch (_) { /* silent */ }

    // RDV rescheduled by pro (in-app reminders of type rdv_rescheduled_by_pro, last 7 days)
    let rescheduledByProNotifs: any[] = [];
    try {
      const sevenDaysAgoR = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const rescheduleReminders = await prisma.bookingReminder.findMany({
        where: {
          athleteUserId: session.id,
          type: "rdv_rescheduled_by_pro",
          channel: "inapp",
          dismissed: false,
          createdAt: { gte: sevenDaysAgoR },
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      rescheduledByProNotifs = rescheduleReminders.map((r: any) => ({
        id: `reschedule-pro-${r.id}`,
        title: `Rendez-vous reprogrammé`,
        subtitle: `${r.eventMotif || ""}${r.eventDate ? ` — nouveau : ${new Date(r.eventDate).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}` : ""}`,
        date: r.createdAt,
        type: "rdv_rescheduled_by_pro",
        color: "blue",
        source: "rdv_rescheduled_by_pro",
        meta: {
          reminderId: r.id,
          proId: r.professionnelId,
          proName: `${r.professionnel.prenom} ${r.professionnel.nom}`,
          proSpecialite: r.professionnel.specialite,
          avatarPath: signAvatarUrl(r.professionnel.avatarPath),
          eventDate: r.eventDate,
          eventTitle: r.eventTitle,
        },
      }));
    } catch (_) { /* silent */ }

    // Consultation prep reminder: upcoming events (next 24h) without completed ConsultationPrep
    let consultPrepNotifs: any[] = [];
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const upcomingEvents = await prisma.calendarEvent.findMany({
        where: {
          athleteUserId: session.id,
          deletedAt: null,
          date: { gt: now, lte: in24h },
        },
        select: {
          id: true, date: true, endDate: true, title: true, professionnelId: true,
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
          consultationPrep: { select: { id: true, completedAt: true } },
        },
      });

      consultPrepNotifs = upcomingEvents
        .filter((e: any) => !e.consultationPrep || !e.consultationPrep.completedAt)
        .map((e: any) => ({
          id: `prep-${e.id}`,
          title: `Préparez votre consultation`,
          subtitle: `${e.professionnel.prenom} ${e.professionnel.nom} — ${new Date(e.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à ${new Date(e.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
          date: new Date(new Date(e.date).getTime() - 24 * 60 * 60 * 1000),
          type: "consultation_prep",
          color: "amber",
          source: "consultation_prep",
          meta: {
            eventId: e.id,
            proId: e.professionnelId,
            proName: `${e.professionnel.prenom} ${e.professionnel.nom}`,
            proSpecialite: e.professionnel.specialite,
            avatarPath: signAvatarUrl(e.professionnel.avatarPath),
            eventDate: e.date,
            eventTitle: e.title,
          },
        }));
    } catch (_) { /* silent */ }

    // Upcoming RDV reminders (appointments in next 3 hours)
    let upcomingRdvNotifs: any[] = [];
    try {
      const now = new Date();
      const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);

      const soonEvents = await prisma.calendarEvent.findMany({
        where: {
          athleteUserId: session.id,
          deletedAt: null,
          date: { gt: now, lte: in3h },
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { date: "asc" },
      });

      upcomingRdvNotifs = soonEvents.map((e: any) => {
        const minsUntil = Math.round((new Date(e.date).getTime() - now.getTime()) / 60000);
        const countdown = minsUntil <= 60
          ? `dans ${minsUntil} min`
          : `dans ${Math.floor(minsUntil / 60)}h${minsUntil % 60 > 0 ? String(minsUntil % 60).padStart(2, "0") : ""}`;
        return {
          id: `upcoming-rdv-${e.id}`,
          title: `RDV ${countdown}`,
          subtitle: `${e.title} — ${e.professionnel.prenom} ${e.professionnel.nom}`,
          date: now,
          type: "upcoming_rdv",
          color: "red",
          source: "upcoming_rdv",
          meta: {
            eventId: e.id,
            proId: e.professionnelId,
            proName: `${e.professionnel.prenom} ${e.professionnel.nom}`,
            proSpecialite: e.professionnel.specialite,
            avatarPath: signAvatarUrl(e.professionnel.avatarPath),
            eventDate: e.date,
            eventTitle: e.title,
            countdown,
            format: e.format,
          },
        };
      });
    } catch (_) { /* silent */ }

    // Payment confirmed (in-app reminders of type payment_confirmed, last 7 days)
    let paymentConfirmedNotifs: any[] = [];
    try {
      const sevenDaysAgoP = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const paymentReminders = await prisma.bookingReminder.findMany({
        where: {
          athleteUserId: session.id,
          type: "payment_confirmed",
          channel: "inapp",
          dismissed: false,
          createdAt: { gte: sevenDaysAgoP },
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      paymentConfirmedNotifs = paymentReminders.map((r: any) => ({
        id: `payment-${r.id}`,
        title: `Paiement confirmé`,
        subtitle: r.eventMotif || `${r.professionnel.prenom} ${r.professionnel.nom}`,
        date: r.createdAt,
        type: "payment_confirmed",
        color: "green",
        source: "payment_confirmed",
        meta: {
          reminderId: r.id,
          proId: r.professionnelId,
          proName: `${r.professionnel.prenom} ${r.professionnel.nom}`,
          proSpecialite: r.professionnel.specialite,
          avatarPath: signAvatarUrl(r.professionnel.avatarPath),
          eventTitle: r.eventTitle,
        },
      }));
    } catch (_) { /* silent */ }

    // Payment failed (in-app reminders of type payment_failed, last 7 days)
    let paymentFailedNotifs: any[] = [];
    try {
      const sevenDaysAgoPF = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const failedReminders = await prisma.bookingReminder.findMany({
        where: {
          athleteUserId: session.id,
          type: "payment_failed",
          channel: "inapp",
          dismissed: false,
          createdAt: { gte: sevenDaysAgoPF },
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      paymentFailedNotifs = failedReminders.map((r: any) => ({
        id: `payment-fail-${r.id}`,
        title: `Paiement échoué`,
        subtitle: r.eventMotif || `${r.professionnel.prenom} ${r.professionnel.nom}`,
        date: r.createdAt,
        type: "payment_failed",
        color: "red",
        source: "payment_failed",
        meta: {
          reminderId: r.id,
          proId: r.professionnelId,
          proName: `${r.professionnel.prenom} ${r.professionnel.nom}`,
          proSpecialite: r.professionnel.specialite,
          avatarPath: signAvatarUrl(r.professionnel.avatarPath),
          eventTitle: r.eventTitle,
        },
      }));
    } catch (_) { /* silent */ }

    // Refund processed (in-app reminders of type refund_processed, last 7 days)
    let refundNotifs: any[] = [];
    try {
      const sevenDaysAgoRF = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const refundReminders = await prisma.bookingReminder.findMany({
        where: {
          athleteUserId: session.id,
          type: "refund_processed",
          channel: "inapp",
          dismissed: false,
          createdAt: { gte: sevenDaysAgoRF },
        },
        include: {
          professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      refundNotifs = refundReminders.map((r: any) => ({
        id: `refund-${r.id}`,
        title: `Remboursement effectué`,
        subtitle: r.eventMotif || `${r.professionnel.prenom} ${r.professionnel.nom}`,
        date: r.createdAt,
        type: "refund_processed",
        color: "purple",
        source: "refund_processed",
        meta: {
          reminderId: r.id,
          proId: r.professionnelId,
          proName: `${r.professionnel.prenom} ${r.professionnel.nom}`,
          proSpecialite: r.professionnel.specialite,
          avatarPath: signAvatarUrl(r.professionnel.avatarPath),
          eventTitle: r.eventTitle,
        },
      }));
    } catch (_) { /* silent */ }

    // Kiné plan, Nutri plan, Ordonnances, Prescriptions, Protocoles & Alertes (active/published in last 7 days)
    let kinePlanNotifs: any[] = [];
    let nutriPlanNotifs: any[] = [];
    let ordonnanceNotifs: any[] = [];
    let prescriptionNotifs: any[] = [];
    let protocolNotifs: any[] = [];
    let medAlertNotifs: any[] = [];
    let nutriAlertNotifs: any[] = [];
    let kineAlertNotifs: any[] = [];
    let sharedDocNotifs: any[] = [];
    try {
      const athleteUser = await prisma.athleteUser.findUnique({
        where: { id: session.id },
        select: { email: true },
      });
      if (athleteUser?.email) {
        const athleteRecords = await prisma.athlete.findMany({
          where: { contactEmail: { equals: athleteUser.email, mode: "insensitive" } },
          select: { id: true, professionnelId: true },
        });
        if (athleteRecords.length > 0) {
          const athleteIds = athleteRecords.map((a: any) => a.id);
          const sevenDaysAgoKP = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          // Kiné plans
          const recentKinePlans = await (prisma as any).kinePlan.findMany({
            where: {
              athleteId: { in: athleteIds },
              status: "active",
              deletedAt: null,
              updatedAt: { gte: sevenDaysAgoKP },
            },
            include: {
              professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
          });

          kinePlanNotifs = recentKinePlans.map((p: any) => ({
            id: `kine-plan-${p.id}`,
            title: `Nouveau plan de rééducation`,
            subtitle: `${p.title} — ${p.professionnel.prenom} ${p.professionnel.nom}`,
            date: p.updatedAt,
            type: "kine_plan_published",
            color: "teal",
            source: "kine_plan_published",
            meta: {
              planId: p.id,
              proId: p.professionnelId,
              proName: `${p.professionnel.prenom} ${p.professionnel.nom}`,
              proSpecialite: p.professionnel.specialite,
              avatarPath: signAvatarUrl(p.professionnel.avatarPath),
              planTitle: p.title,
              planObjective: p.objective,
            },
          }));

          // Nutri plans (status: publie or en_cours)
          const recentNutriPlans = await (prisma as any).nutriPlan.findMany({
            where: {
              athleteId: { in: athleteIds },
              status: { in: ["publie", "en_cours"] },
              deletedAt: null,
              updatedAt: { gte: sevenDaysAgoKP },
            },
            include: {
              professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
          });

          nutriPlanNotifs = recentNutriPlans.map((p: any) => ({
            id: `nutri-plan-${p.id}`,
            title: `Nouveau plan alimentaire`,
            subtitle: `${p.name} — ${p.professionnel.prenom} ${p.professionnel.nom}`,
            date: p.updatedAt,
            type: "nutri_plan_published",
            color: "emerald",
            source: "nutri_plan_published",
            meta: {
              planId: p.id,
              proId: p.proId,
              proName: `${p.professionnel.prenom} ${p.professionnel.nom}`,
              proSpecialite: p.professionnel.specialite,
              avatarPath: signAvatarUrl(p.professionnel.avatarPath),
              planName: p.name,
            },
          }));

          // Ordonnances (status: signee or transmise)
          const recentOrdonnances = await (prisma as any).medOrdonnance.findMany({
            where: {
              athleteId: { in: athleteIds },
              status: { in: ["signee", "transmise"] },
              deletedAt: null,
              updatedAt: { gte: sevenDaysAgoKP },
            },
            include: {
              professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
          });

          ordonnanceNotifs = recentOrdonnances.map((o: any) => ({
            id: `ordonnance-${o.id}`,
            title: `Nouvelle ordonnance disponible`,
            subtitle: `${o.type} — ${o.professionnel.prenom} ${o.professionnel.nom}`,
            date: o.signedAt || o.updatedAt,
            type: "ordonnance_available",
            color: "blue",
            source: "ordonnance_available",
            meta: {
              ordonnanceId: o.id,
              ordonnanceType: o.type,
              proId: o.proId,
              proName: `${o.professionnel.prenom} ${o.professionnel.nom}`,
              proSpecialite: o.professionnel.specialite,
              avatarPath: signAvatarUrl(o.professionnel.avatarPath),
              diagnosis: o.diagnosis,
            },
          }));

          // Prescriptions (active, visible to patient)
          const recentPrescriptions = await (prisma as any).medPrescription.findMany({
            where: {
              athleteId: { in: athleteIds },
              status: "active",
              visiblePatient: true,
              createdAt: { gte: sevenDaysAgoKP },
            },
            include: {
              professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          prescriptionNotifs = recentPrescriptions.map((rx: any) => ({
            id: `prescription-${rx.id}`,
            title: `Nouvelle prescription`,
            subtitle: `${rx.title} — ${rx.professionnel.prenom} ${rx.professionnel.nom}`,
            date: rx.createdAt,
            type: "prescription_available",
            color: "violet",
            source: "prescription_available",
            meta: {
              prescriptionId: rx.id,
              prescriptionType: rx.type,
              prescriptionTitle: rx.title,
              proId: rx.proId,
              proName: `${rx.professionnel.prenom} ${rx.professionnel.nom}`,
              proSpecialite: rx.professionnel.specialite,
              avatarPath: signAvatarUrl(rx.professionnel.avatarPath),
            },
          }));

          // Protocoles (status: active)
          const recentProtocols = await (prisma as any).medProtocol.findMany({
            where: {
              athleteId: { in: athleteIds },
              status: "active",
              deletedAt: null,
              updatedAt: { gte: sevenDaysAgoKP },
            },
            include: {
              professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 10,
          });

          protocolNotifs = recentProtocols.map((pr: any) => ({
            id: `protocol-${pr.id}`,
            title: `Nouveau protocole médical`,
            subtitle: `${pr.name} — ${pr.professionnel.prenom} ${pr.professionnel.nom}`,
            date: pr.updatedAt,
            type: "protocol_published",
            color: "indigo",
            source: "protocol_published",
            meta: {
              protocolId: pr.id,
              protocolName: pr.name,
              protocolDescription: pr.description,
              proId: pr.proId,
              proName: `${pr.professionnel.prenom} ${pr.professionnel.nom}`,
              proSpecialite: pr.professionnel.specialite,
              avatarPath: signAvatarUrl(pr.professionnel.avatarPath),
            },
          }));

          // Alertes médicales (warning/critical, open)
          const recentAlerts = await (prisma as any).medAlert.findMany({
            where: {
              athleteId: { in: athleteIds },
              severity: { in: ["warning", "critical"] },
              status: "open",
              createdAt: { gte: sevenDaysAgoKP },
            },
            include: {
              professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          medAlertNotifs = recentAlerts.map((a: any) => ({
            id: `med-alert-${a.id}`,
            title: a.severity === "critical" ? `Alerte médicale urgente` : `Alerte médicale`,
            subtitle: `${a.title} — ${a.professionnel.prenom} ${a.professionnel.nom}`,
            date: a.createdAt,
            type: "med_alert",
            color: a.severity === "critical" ? "red" : "amber",
            source: "med_alert",
            meta: {
              alertId: a.id,
              alertSeverity: a.severity,
              alertTitle: a.title,
              alertDescription: a.description,
              proId: a.proId,
              proName: `${a.professionnel.prenom} ${a.professionnel.nom}`,
              proSpecialite: a.professionnel.specialite,
              avatarPath: signAvatarUrl(a.professionnel.avatarPath),
            },
          }));

          // Alertes nutritionnelles (status: unread)
          const recentNutriAlerts = await (prisma as any).nutriAlert.findMany({
            where: {
              athleteId: { in: athleteIds },
              status: "unread",
              createdAt: { gte: sevenDaysAgoKP },
            },
            include: {
              athlete: {
                select: {
                  professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          nutriAlertNotifs = recentNutriAlerts.map((na: any) => ({
            id: `nutri-alert-${na.id}`,
            title: na.severity === "urgent" ? `Alerte nutritionnelle urgente` : `Alerte nutritionnelle`,
            subtitle: `${na.title} — ${na.athlete.professionnel.prenom} ${na.athlete.professionnel.nom}`,
            date: na.createdAt,
            type: "nutri_alert",
            color: na.severity === "urgent" ? "red" : "orange",
            source: "nutri_alert",
            meta: {
              alertId: na.id,
              alertSeverity: na.severity,
              alertTitle: na.title,
              alertDescription: na.description,
              alertAction: na.action,
              proId: na.athlete.professionnel.id,
              proName: `${na.athlete.professionnel.prenom} ${na.athlete.professionnel.nom}`,
              proSpecialite: na.athlete.professionnel.specialite,
              avatarPath: signAvatarUrl(na.athlete.professionnel.avatarPath),
            },
          }));

          // Kiné alerts (pain alerts, compliance issues from kiné)
          try {
            const recentKineAlerts = await (prisma as any).kineAlert.findMany({
              where: {
                athleteId: { in: athleteIds },
                status: "open",
                createdAt: { gte: sevenDaysAgoKP },
              },
              include: {
                athlete: {
                  select: {
                    professionnel: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
                  },
                },
              },
              orderBy: { createdAt: "desc" },
              take: 10,
            });

            kineAlertNotifs = recentKineAlerts.map((ka: any) => ({
              id: `kine-alert-${ka.id}`,
              title: ka.severity === "high" ? `Alerte kiné urgente` : `Alerte kiné`,
              subtitle: `${ka.reason} — ${ka.athlete.professionnel.prenom} ${ka.athlete.professionnel.nom}`,
              date: ka.createdAt,
              type: "kine_alert",
              color: ka.severity === "high" ? "red" : "amber",
              source: "kine_alert",
              meta: {
                alertId: ka.id,
                alertSeverity: ka.severity,
                alertReason: ka.reason,
                alertDetails: ka.details,
                proId: ka.athlete.professionnel.id,
                proName: `${ka.athlete.professionnel.prenom} ${ka.athlete.professionnel.nom}`,
                proSpecialite: ka.athlete.professionnel.specialite,
                avatarPath: signAvatarUrl(ka.athlete.professionnel.avatarPath),
              },
            }));
          } catch (_) { /* kineAlert table might not exist */ }

          // Documents partagés (non lus, envoyés à l'athlète)
          const recentSharedDocs = await (prisma as any).sharedDocument.findMany({
            where: {
              receiverAthleteId: { in: athleteIds },
              readAt: null,
              deletedAt: null,
              createdAt: { gte: sevenDaysAgoKP },
            },
            include: {
              senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          });

          sharedDocNotifs = recentSharedDocs.map((d: any) => ({
            id: `shared-doc-${d.id}`,
            title: `Nouveau document partagé`,
            subtitle: `${d.originalName} — ${d.senderPro.prenom} ${d.senderPro.nom}`,
            date: d.createdAt,
            type: "shared_document",
            color: "sky",
            source: "shared_document",
            meta: {
              documentId: d.id,
              documentName: d.originalName,
              documentCategory: d.category,
              documentNote: d.note,
              proId: d.senderProId,
              proName: `${d.senderPro.prenom} ${d.senderPro.nom}`,
              proSpecialite: d.senderPro.specialite,
              avatarPath: signAvatarUrl(d.senderPro.avatarPath),
            },
          }));
        }
      }
    } catch (_) { /* silent */ }

    return NextResponse.json([...upcomingRdvNotifs, ...medAlertNotifs, ...nutriAlertNotifs, ...kineAlertNotifs, ...cancelledByProNotifs, ...rescheduledByProNotifs, ...paymentFailedNotifs, ...refundNotifs, ...consultPrepNotifs, ...paymentConfirmedNotifs, ...kinePlanNotifs, ...nutriPlanNotifs, ...ordonnanceNotifs, ...prescriptionNotifs, ...protocolNotifs, ...sharedDocNotifs, ...sessionNotifs, ...feedbackRequestedNotifs, ...dataAccessNotifs, ...slotAlertNotifs, ...connectionNotifs, ...connectionAcceptedNotifs, ...connectionRejectedNotifs, ...groupMessageNotifs, ...healthSyncNotifs, ...notifications]);
  } catch (error) {
    console.error("GET /api/athlete/notifications error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
