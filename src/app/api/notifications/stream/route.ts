import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionPro } from "@/lib/session";
import { signAvatarUrl } from "@/lib/signedUrl";

// Force dynamic (no static caching)
export const dynamic = "force-dynamic";

// ─── Fetch all notifications for a given pro (extracted from GET handler) ───

async function getNotificationsForPro(proId: string) {
  const now = new Date();

  // Calendar events with reminders due
  const events = await prisma.calendarEvent.findMany({
    where: { professionnelId: proId, reminderMinutes: { not: null }, reminderSeen: false },
    include: { athlete: { select: { id: true, name: true } } },
    orderBy: { date: "asc" },
  });

  const dueEvents = events
    .filter((ev) => now >= new Date(ev.date.getTime() - (ev.reminderMinutes! * 60 * 1000)))
    .map((ev) => ({
      id: ev.id,
      title: ev.title,
      date: ev.date,
      type: ev.type,
      color: ev.color,
      athlete: ev.athlete,
      source: "event" as const,
    }));

  // Kanban tasks with dueDate + reminder due
  const tasks = await prisma.kanbanTask.findMany({
    where: { professionnelId: proId, reminderMinutes: { not: null }, reminderSeen: false, dueDate: { not: null } },
    include: { athlete: { select: { id: true, name: true } } },
    orderBy: { dueDate: "asc" },
  });

  const dueTasks = tasks
    .filter((t) => now >= new Date(t.dueDate!.getTime() - (t.reminderMinutes! * 60 * 1000)))
    .map((t) => ({
      id: t.id,
      title: t.title,
      date: t.dueDate!,
      type: "task",
      color: t.priority === "high" ? "red" : t.priority === "medium" ? "orange" : "gray",
      athlete: t.athlete,
      source: "kanban" as const,
    }));

  // Kanban tasks overdue
  const overdue = await prisma.kanbanTask.findMany({
    where: { professionnelId: proId, dueDate: { lt: now }, column: { not: "done" }, reminderSeen: false, reminderMinutes: null },
    include: { athlete: { select: { id: true, name: true } } },
  });

  const overdueNotifs = overdue.map((t) => ({
    id: t.id,
    title: t.title,
    date: t.dueDate!,
    type: "task",
    color: "red",
    athlete: t.athlete,
    source: "kanban" as const,
  }));

  // Pending invitations received
  const proRecord = await (prisma as any).professionnel.findUnique({
    where: { id: proId },
    select: { email: true },
  });

  let inviteNotifs: any[] = [];
  if (proRecord?.email) {
    const pendingInvites = await (prisma as any).proInvitation.findMany({
      where: { email: proRecord.email, status: "envoyee" },
      include: {
        senderPro: { select: { nom: true, prenom: true, specialite: true } },
        athlete: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    inviteNotifs = pendingInvites.map((inv: any) => ({
      id: inv.id,
      title: `${inv.senderPro.prenom} ${inv.senderPro.nom} vous invite à collaborer`,
      date: inv.createdAt,
      type: "invite",
      color: "orange",
      athlete: { name: inv.athlete.name },
      source: "invite" as const,
      meta: {
        role: inv.role,
        senderName: `${inv.senderPro.prenom} ${inv.senderPro.nom}`,
        senderSpecialite: inv.senderPro.specialite,
        athleteName: inv.athlete.name,
      },
    }));
  }

  // Unread messages grouped by sender
  let messageNotifs: any[] = [];
  try {
    const unreadMessages = await (prisma as any).proMessage.findMany({
      where: { receiverProId: proId, read: false },
      include: {
        senderPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byPro = new Map<string, { sender: any; count: number; lastMsg: any }>();
    for (const msg of unreadMessages) {
      const key = msg.senderProId;
      if (!byPro.has(key)) {
        byPro.set(key, { sender: msg.senderPro, count: 1, lastMsg: msg });
      } else {
        byPro.get(key)!.count++;
      }
    }

    messageNotifs = Array.from(byPro.values()).map((g) => ({
      id: `msg-${g.sender.id}`,
      title: `${g.sender.prenom} ${g.sender.nom}`,
      subtitle: g.count === 1 ? g.lastMsg.content : `${g.count} nouveaux messages`,
      date: g.lastMsg.createdAt,
      type: "message",
      color: "blue",
      source: "message" as const,
      meta: {
        proId: g.sender.id,
        senderName: `${g.sender.prenom} ${g.sender.nom}`,
        senderSpecialite: g.sender.specialite,
        avatarPath: signAvatarUrl(g.sender.avatarPath),
        preview: g.lastMsg.content,
        count: g.count,
      },
    }));
  } catch (_) { /* proMessage table might not exist yet */ }

  // Security alerts (last 7 days)
  let securityNotifs: any[] = [];
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const secAlerts = await prisma.securityAlert.findMany({
      where: {
        professionnelId: proId,
        createdAt: { gte: sevenDaysAgo },
        type: {
          in: [
            "new_device_login",
            "data_exported",
            "password_changed",
            "suspicious_login_blocked",
            "login_locked",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const securityMeta: Record<string, { icon: string; color: string }> = {
      new_device_login:         { icon: "🖥️", color: "blue" },
      data_exported:            { icon: "📤", color: "orange" },
      password_changed:         { icon: "🔑", color: "green" },
      suspicious_login_blocked: { icon: "🚫", color: "red" },
      login_locked:             { icon: "🔒", color: "red" },
    };

    securityNotifs = secAlerts.map((a) => {
      const meta = securityMeta[a.type] || { icon: "🛡️", color: "gray" };
      return {
        id: `sec-${a.id}`,
        title: `${meta.icon} ${a.message}`,
        date: a.createdAt,
        type: "security",
        color: meta.color,
        athlete: null,
        source: "security" as const,
        meta: { alertType: a.type, ip: a.ip },
      };
    });
  } catch (_) { /* securityAlert table might not exist yet */ }

  // Connection requests from athletes
  let connectionNotifs: any[] = [];
  try {
    const pendingConnections = await (prisma as any).connectionRequest.findMany({
      where: { professionnelId: proId, status: "pending", requestedBy: "athlete" },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, sport: true, avatarPath: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    connectionNotifs = pendingConnections.map((c: any) => ({
      id: `conn-${c.id}`,
      title: `${c.athleteUser.prenom} ${c.athleteUser.nom} souhaite se connecter`,
      date: c.createdAt,
      type: "connection_request",
      color: "green",
      athlete: { id: c.athleteUser.id, name: `${c.athleteUser.prenom} ${c.athleteUser.nom}` },
      source: "connection" as const,
      meta: {
        requestId: c.id,
        athletePrenom: c.athleteUser.prenom,
        athleteNom: c.athleteUser.nom,
        athleteSport: c.athleteUser.sport,
        avatarPath: signAvatarUrl(c.athleteUser.avatarPath),
      },
    }));
  } catch (_) { /* connectionRequest table might not exist yet */ }

  // Recently accepted connections (pro-initiated, accepted in last 2 min)
  let acceptedNotifs: any[] = [];
  try {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentlyAccepted = await (prisma as any).connectionRequest.findMany({
      where: {
        professionnelId: proId,
        status: "accepted",
        requestedBy: "pro",
        respondedAt: { gte: twoMinAgo },
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, sport: true, avatarPath: true } },
      },
      orderBy: { respondedAt: "desc" },
    });

    acceptedNotifs = recentlyAccepted.map((c: any) => ({
      id: `conn-accepted-${c.id}`,
      title: `${c.athleteUser.prenom} ${c.athleteUser.nom} a accepté votre demande`,
      date: c.respondedAt || c.createdAt,
      type: "connection_accepted",
      color: "green",
      athlete: { id: c.athleteUser.id, name: `${c.athleteUser.prenom} ${c.athleteUser.nom}` },
      source: "connection_accepted" as const,
      meta: {
        requestId: c.id,
        athleteUserId: c.athleteUser.id,
        athletePrenom: c.athleteUser.prenom,
        athleteNom: c.athleteUser.nom,
        athleteSport: c.athleteUser.sport,
        avatarPath: signAvatarUrl(c.athleteUser.avatarPath),
      },
    }));
  } catch (_) { /* silent */ }

  // Athlete waiting in visio room (join signal in last 5 min)
  let visioJoinNotifs: any[] = [];
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    // Find CalendarEvents with visioRoomId belonging to this pro
    const visioEvents = await (prisma as any).calendarEvent.findMany({
      where: { professionnelId: proId, visioRoomId: { not: null }, deletedAt: null },
      select: { visioRoomId: true, title: true, date: true, athleteUserId: true, athlete: { select: { id: true, name: true } } },
    });
    const roomMap: Map<string, any> = new Map(visioEvents.map((e: any) => [e.visioRoomId, e]));
    if (roomMap.size > 0) {
      const joinSignals = await (prisma as any).visioSignal.findMany({
        where: {
          roomId: { in: Array.from(roomMap.keys()) },
          type: "join",
          senderId: { startsWith: "athlete:" },
          createdAt: { gte: fiveMinAgo },
        },
        orderBy: { createdAt: "desc" },
      });
      // Deduplicate by roomId (keep latest)
      const seenRooms = new Set<string>();
      for (const sig of joinSignals) {
        if (seenRooms.has(sig.roomId)) continue;
        seenRooms.add(sig.roomId);
        const ev = roomMap.get(sig.roomId);
        if (!ev) continue;
        visioJoinNotifs.push({
          id: `visio-join-${sig.id}`,
          title: `${ev.athlete?.name || "Un patient"} vous attend en salle d'attente`,
          subtitle: ev.title,
          date: sig.createdAt,
          type: "visio_join",
          color: "green",
          athlete: ev.athlete ? { id: ev.athlete.id, name: ev.athlete.name } : null,
          source: "visio_join" as const,
          meta: { roomId: sig.roomId, eventTitle: ev.title },
        });
      }
    }
  } catch (_) { /* VisioSignal table might not exist yet */ }

  // Unread athlete→pro messages (grouped by athlete)
  let athleteMessageNotifs: any[] = [];
  try {
    const unreadAthleteMessages = await (prisma as any).athleteProMessage.findMany({
      where: { professionnelId: proId, senderType: "athlete", read: false },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, avatarPath: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byAthlete = new Map<string, { athlete: any; count: number; lastMsg: any }>();
    for (const msg of unreadAthleteMessages) {
      const key = msg.athleteUserId;
      if (!byAthlete.has(key)) {
        byAthlete.set(key, { athlete: msg.athleteUser, count: 1, lastMsg: msg });
      } else {
        byAthlete.get(key)!.count++;
      }
    }

    athleteMessageNotifs = Array.from(byAthlete.values()).map((g) => ({
      id: `ath-msg-${g.athlete.id}`,
      title: `${g.athlete.prenom} ${g.athlete.nom}`,
      subtitle: g.count === 1 ? g.lastMsg.content : `${g.count} nouveaux messages`,
      date: g.lastMsg.createdAt,
      type: "athlete_message",
      color: "blue",
      athlete: { id: g.athlete.id, name: `${g.athlete.prenom} ${g.athlete.nom}` },
      source: "athlete_message" as const,
      meta: {
        athleteUserId: g.athlete.id,
        senderName: `${g.athlete.prenom} ${g.athlete.nom}`,
        avatarPath: signAvatarUrl(g.athlete.avatarPath),
        preview: g.lastMsg.content,
        count: g.count,
      },
    }));
  } catch (_) { /* silent */ }

  // Connection rejected by athlete (last 7 days)
  let connRejectedNotifs: any[] = [];
  try {
    const sevenDaysAgoCR = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rejectedConns = await (prisma as any).connectionRequest.findMany({
      where: {
        professionnelId: proId,
        status: "rejected",
        requestedBy: "pro",
        respondedAt: { gte: sevenDaysAgoCR },
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, sport: true, avatarPath: true } },
      },
      orderBy: { respondedAt: "desc" },
    });

    connRejectedNotifs = rejectedConns.map((c: any) => ({
      id: `conn-rejected-${c.id}`,
      title: `${c.athleteUser.prenom} ${c.athleteUser.nom} a décliné votre demande`,
      date: c.respondedAt || c.createdAt,
      type: "connection_rejected",
      color: "gray",
      athlete: { id: c.athleteUser.id, name: `${c.athleteUser.prenom} ${c.athleteUser.nom}` },
      source: "connection_rejected" as const,
      meta: {
        requestId: c.id,
        athleteUserId: c.athleteUser.id,
        avatarPath: signAvatarUrl(c.athleteUser.avatarPath),
      },
    }));
  } catch (_) { /* silent */ }

  // New appointments booked by athlete (last 24h)
  let newBookingNotifs: any[] = [];
  try {
    const oneDayAgoB = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentBookings = await prisma.calendarEvent.findMany({
      where: {
        professionnelId: proId,
        athleteUserId: { not: null },
        createdAt: { gte: oneDayAgoB },
        deletedAt: null,
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, avatarPath: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    newBookingNotifs = recentBookings.map((ev) => ({
      id: `booking-${ev.id}`,
      title: `Nouveau RDV réservé`,
      subtitle: `${ev.athleteUser?.prenom || ""} ${ev.athleteUser?.nom || ""} — ${ev.title} le ${ev.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}`,
      date: ev.createdAt,
      type: "new_booking",
      color: "blue",
      athlete: ev.athleteUser ? { id: ev.athleteUser.id, name: `${ev.athleteUser.prenom} ${ev.athleteUser.nom}` } : null,
      source: "booking" as const,
      meta: {
        eventId: ev.id,
        eventTitle: ev.title,
        eventDate: ev.date,
        athleteUserId: ev.athleteUserId,
        avatarPath: signAvatarUrl(ev.athleteUser?.avatarPath ?? null),
      },
    }));
  } catch (_) { /* silent */ }

  // Appointments cancelled by athlete (last 7 days)
  let cancelledByAthleteNotifs: any[] = [];
  try {
    const sevenDaysAgoCA = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const cancelledEvents = await prisma.calendarEvent.findMany({
      where: {
        professionnelId: proId,
        deletedAt: { gte: sevenDaysAgoCA },
        deletedBy: { not: proId },
        athleteUserId: { not: null },
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, avatarPath: true } },
      },
      orderBy: { deletedAt: "desc" },
      take: 20,
    });

    cancelledByAthleteNotifs = cancelledEvents.map((ev) => ({
      id: `cancel-athlete-${ev.id}`,
      title: `RDV annulé par le patient`,
      subtitle: `${ev.athleteUser?.prenom || ""} ${ev.athleteUser?.nom || ""} — ${ev.title} du ${ev.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}`,
      date: ev.deletedAt!,
      type: "cancelled_by_athlete",
      color: "red",
      athlete: ev.athleteUser ? { id: ev.athleteUser.id, name: `${ev.athleteUser.prenom} ${ev.athleteUser.nom}` } : null,
      source: "cancelled_by_athlete" as const,
      meta: {
        eventId: ev.id,
        eventTitle: ev.title,
        eventDate: ev.date,
        avatarPath: signAvatarUrl(ev.athleteUser?.avatarPath ?? null),
      },
    }));
  } catch (_) { /* silent */ }

  // Payments received (last 7 days)
  let paymentReceivedNotifs: any[] = [];
  try {
    const sevenDaysAgoPR = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const paidPayments = await prisma.payment.findMany({
      where: {
        professionnelId: proId,
        paidAt: { gte: sevenDaysAgoPR },
        status: { in: ["paid", "payment_received"] },
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 20,
    });

    paymentReceivedNotifs = paidPayments.map((p) => ({
      id: `pay-ok-${p.id}`,
      title: `Paiement reçu`,
      subtitle: `${p.athleteUser?.prenom || ""} ${p.athleteUser?.nom || ""} — ${(p.amount / 100).toFixed(2)} €`,
      date: p.paidAt!,
      type: "payment_received",
      color: "green",
      athlete: p.athleteUser ? { id: p.athleteUser.id, name: `${p.athleteUser.prenom} ${p.athleteUser.nom}` } : null,
      source: "payment" as const,
      meta: {
        paymentId: p.id,
        amount: p.amount,
        currency: p.currency,
        athleteUserId: p.athleteUserId,
      },
    }));
  } catch (_) { /* silent */ }

  // Payments failed or refunded (last 7 days)
  let paymentFailedNotifs: any[] = [];
  try {
    const sevenDaysAgoPF = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const failedPayments = await prisma.payment.findMany({
      where: {
        professionnelId: proId,
        updatedAt: { gte: sevenDaysAgoPF },
        status: { in: ["payment_failed", "refunded", "partially_refunded", "disputed"] },
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    const payStatusLabels: Record<string, string> = {
      payment_failed: "Paiement échoué",
      refunded: "Remboursement effectué",
      partially_refunded: "Remboursement partiel",
      disputed: "Litige en cours",
    };

    paymentFailedNotifs = failedPayments.map((p) => ({
      id: `pay-fail-${p.id}`,
      title: payStatusLabels[p.status] || "Problème de paiement",
      subtitle: `${p.athleteUser?.prenom || ""} ${p.athleteUser?.nom || ""} — ${(p.amount / 100).toFixed(2)} €`,
      date: p.refundedAt || p.updatedAt,
      type: "payment_failed",
      color: "red",
      athlete: p.athleteUser ? { id: p.athleteUser.id, name: `${p.athleteUser.prenom} ${p.athleteUser.nom}` } : null,
      source: "payment" as const,
      meta: {
        paymentId: p.id,
        amount: p.amount,
        refundAmount: p.refundAmount,
        status: p.status,
        athleteUserId: p.athleteUserId,
      },
    }));
  } catch (_) { /* silent */ }

  // Consultation prep completed by athlete (last 7 days)
  let consultPrepNotifs: any[] = [];
  try {
    const sevenDaysAgoCP = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const completedPreps = await (prisma as any).consultationPrep.findMany({
      where: {
        completedAt: { gte: sevenDaysAgoCP, not: null },
        calendarEvent: { professionnelId: proId, deletedAt: null },
      },
      include: {
        calendarEvent: { select: { id: true, title: true, date: true } },
        athleteUser: { select: { id: true, prenom: true, nom: true, avatarPath: true } },
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    });

    consultPrepNotifs = completedPreps.map((cp: any) => ({
      id: `prep-${cp.id}`,
      title: `Préparation remplie`,
      subtitle: `${cp.athleteUser?.prenom || ""} ${cp.athleteUser?.nom || ""} — ${cp.calendarEvent?.title || "RDV"} le ${cp.calendarEvent?.date ? new Date(cp.calendarEvent.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : ""}`,
      date: cp.completedAt,
      type: "consult_prep",
      color: "blue",
      athlete: cp.athleteUser ? { id: cp.athleteUser.id, name: `${cp.athleteUser.prenom} ${cp.athleteUser.nom}` } : null,
      source: "consult_prep" as const,
      meta: {
        prepId: cp.id,
        eventId: cp.calendarEvent?.id,
        eventTitle: cp.calendarEvent?.title,
        eventDate: cp.calendarEvent?.date,
        avatarPath: signAvatarUrl(cp.athleteUser?.avatarPath),
      },
    }));
  } catch (_) { /* silent */ }

  // Athlete feedback on coach sessions (last 7 days)
  let athleteFeedbackNotifs: any[] = [];
  try {
    const sevenDaysAgoFB = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const feedbackSessions = await (prisma as any).session.findMany({
      where: {
        professionnelId: proId,
        feedbackAthlete: { not: null },
        updatedAt: { gte: sevenDaysAgoFB },
        status: { in: ["en_cours", "realisee"] },
        deletedAt: null,
      },
      include: {
        athlete: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });

    athleteFeedbackNotifs = feedbackSessions.map((s: any) => ({
      id: `feedback-pro-${s.id}`,
      title: `Feedback reçu`,
      subtitle: `${s.athlete?.name || "Athlète"} — ${s.name}`,
      date: s.updatedAt,
      type: "athlete_feedback",
      color: "violet",
      athlete: s.athlete ? { id: s.athlete.id, name: s.athlete.name } : null,
      source: "athlete_feedback" as const,
      meta: {
        sessionId: s.id,
        sessionName: s.name,
        feedback: s.feedbackAthlete?.slice(0, 120),
        rpe: s.rpeRessenti,
        douleur: s.douleur,
      },
    }));
  } catch (_) { /* silent */ }

  // Documents sent by athlete (unread, last 30 days)
  let athleteDocNotifs: any[] = [];
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const unreadDocs = await (prisma as any).athleteDocument.findMany({
      where: {
        professionnelId: proId,
        readAt: null,
        deletedAt: null,
        createdAt: { gte: thirtyDaysAgo },
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, avatarPath: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    athleteDocNotifs = unreadDocs.map((d: any) => ({
      id: `ath-doc-${d.id}`,
      title: `Document reçu`,
      subtitle: `${d.athleteUser?.prenom || ""} ${d.athleteUser?.nom || ""} — ${d.originalName || d.filename}`,
      date: d.createdAt,
      type: "athlete_document",
      color: "orange",
      athlete: d.athleteUser ? { id: d.athleteUser.id, name: `${d.athleteUser.prenom} ${d.athleteUser.nom}` } : null,
      source: "athlete_document" as const,
      meta: {
        documentId: d.id,
        filename: d.originalName || d.filename,
        category: d.category,
        avatarPath: signAvatarUrl(d.athleteUser?.avatarPath),
      },
    }));
  } catch (_) { /* silent */ }

  // Kiné alerts (unread)
  let kineAlertNotifs: any[] = [];
  try {
    const kineAlerts = await (prisma as any).kineAlert.findMany({
      where: {
        professionnelId: proId,
        status: "unread",
      },
      include: {
        athlete: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    kineAlertNotifs = kineAlerts.map((a: any) => ({
      id: `kine-alert-${a.id}`,
      title: a.title,
      subtitle: a.description?.slice(0, 100) || "",
      date: a.createdAt,
      type: "kine_alert",
      color: (a.intensity ?? 0) >= 7 ? "red" : "orange",
      athlete: a.athlete ? { id: a.athlete.id, name: a.athlete.name } : null,
      source: "kine_alert" as const,
      meta: {
        alertId: a.id,
        intensity: a.intensity,
        origin: a.origin,
      },
    }));
  } catch (_) { /* silent */ }

  // Nutrition alerts (unread)
  let nutriAlertNotifs: any[] = [];
  try {
    const nutriAlerts = await (prisma as any).nutriAlert.findMany({
      where: {
        status: "unread",
        athlete: { professionnelId: proId },
      },
      include: {
        athlete: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    nutriAlertNotifs = nutriAlerts.map((a: any) => ({
      id: `nutri-alert-${a.id}`,
      title: a.title,
      subtitle: a.description?.slice(0, 100) || "",
      date: a.createdAt,
      type: "nutri_alert",
      color: a.severity === "urgent" ? "red" : "orange",
      athlete: a.athlete ? { id: a.athlete.id, name: a.athlete.name } : null,
      source: "nutri_alert" as const,
      meta: {
        alertId: a.id,
        severity: a.severity,
        origin: a.origin,
      },
    }));
  } catch (_) { /* silent */ }

  // Medical alerts (open, warning/critical)
  let medAlertNotifs: any[] = [];
  try {
    const medAlerts = await (prisma as any).medAlert.findMany({
      where: {
        proId: proId,
        status: "open",
        severity: { in: ["warning", "critical"] },
      },
      include: {
        athlete: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    medAlertNotifs = medAlerts.map((a: any) => ({
      id: `med-alert-${a.id}`,
      title: a.title,
      subtitle: a.description?.slice(0, 100) || "",
      date: a.createdAt,
      type: "med_alert",
      color: a.severity === "critical" ? "red" : "orange",
      athlete: a.athlete ? { id: a.athlete.id, name: a.athlete.name } : null,
      source: "med_alert" as const,
      meta: {
        alertId: a.id,
        severity: a.severity,
        source: a.source,
      },
    }));
  } catch (_) { /* silent */ }

  // Exercise logs from athletes (last 3 days, grouped by plan)
  let exerciseLogNotifs: any[] = [];
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const recentLogs = await (prisma as any).exerciseLog.findMany({
      where: {
        done: true,
        createdAt: { gte: threeDaysAgo },
        plan: { professionnelId: proId },
      },
      include: {
        plan: { select: { id: true, title: true, athleteId: true, athlete: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const byPlan = new Map<string, { plan: any; count: number; lastLog: any }>();
    for (const log of recentLogs) {
      const key = log.planId;
      if (!byPlan.has(key)) {
        byPlan.set(key, { plan: log.plan, count: 1, lastLog: log });
      } else {
        byPlan.get(key)!.count++;
      }
    }

    exerciseLogNotifs = Array.from(byPlan.entries()).map(([planId, g]) => ({
      id: `exlog-${planId}`,
      title: `Exercices réalisés`,
      subtitle: `${g.plan.athlete?.name || "Athlète"} — ${g.count} exercice${g.count > 1 ? "s" : ""} (${g.plan.title})`,
      date: g.lastLog.createdAt,
      type: "exercise_log",
      color: "green",
      athlete: g.plan.athlete ? { id: g.plan.athlete.id, name: g.plan.athlete.name } : null,
      source: "exercise_log" as const,
      meta: {
        planId,
        planTitle: g.plan.title,
        count: g.count,
      },
    }));
  } catch (_) { /* silent */ }

  // Data access request responses (last 7 days)
  let dataAccessNotifs: any[] = [];
  try {
    const sevenDaysAgoDA = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const responses = await (prisma as any).dataAccessRequest.findMany({
      where: {
        professionnelId: proId,
        status: { in: ["accepted", "rejected"] },
        respondedAt: { gte: sevenDaysAgoDA },
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true, avatarPath: true } },
      },
      orderBy: { respondedAt: "desc" },
      take: 20,
    });

    dataAccessNotifs = responses.map((r: any) => ({
      id: `data-access-${r.id}`,
      title: r.status === "accepted" ? `Accès autorisé` : `Accès refusé`,
      subtitle: `${r.athleteUser?.prenom || ""} ${r.athleteUser?.nom || ""} — ${r.dataKey}`,
      date: r.respondedAt,
      type: r.status === "accepted" ? "data_access_accepted" : "data_access_rejected",
      color: r.status === "accepted" ? "green" : "gray",
      athlete: r.athleteUser ? { id: r.athleteUser.id, name: `${r.athleteUser.prenom} ${r.athleteUser.nom}` } : null,
      source: "data_access" as const,
      meta: {
        requestId: r.id,
        dataKey: r.dataKey,
        status: r.status,
        avatarPath: signAvatarUrl(r.athleteUser?.avatarPath),
      },
    }));
  } catch (_) { /* silent */ }

  // Delay notices (BookingReminder type="delay_notice", last 2h)
  let delayNotifs: any[] = [];
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const delays = await prisma.bookingReminder.findMany({
      where: {
        professionnelId: proId,
        type: "delay_notice",
        createdAt: { gte: twoHoursAgo },
        dismissed: false,
      },
      include: {
        athleteUser: { select: { id: true, prenom: true, nom: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    delayNotifs = delays.map((d) => ({
      id: `delay-${d.id}`,
      title: `⏰ Retard signalé`,
      subtitle: `${d.athleteUser?.prenom || ""} ${d.athleteUser?.nom || ""} — ${d.eventMotif || ""}`,
      date: d.createdAt,
      type: "delay_notice",
      color: "amber",
      athlete: d.athleteUser ? { id: d.athleteUser.id, name: `${d.athleteUser.prenom} ${d.athleteUser.nom}` } : null,
      source: "delay_notice" as const,
      meta: {
        reminderId: d.id,
        eventTitle: d.eventTitle,
        eventDate: d.eventDate,
      },
    }));
  } catch (_) { /* silent */ }

  // Overdue invoices
  let invoiceOverdueNotifs: any[] = [];
  try {
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        professionnelId: proId,
        status: "overdue",
        deletedAt: null,
      },
      include: {
        athlete: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
    });

    invoiceOverdueNotifs = overdueInvoices.map((inv) => ({
      id: `inv-overdue-${inv.id}`,
      title: `Facture en retard`,
      subtitle: `${inv.athlete?.name || "Patient"} — ${inv.amount.toFixed(2)} € (${inv.number})`,
      date: inv.dueDate,
      type: "invoice_overdue",
      color: "red",
      athlete: inv.athlete ? { id: inv.athlete.id, name: inv.athlete.name } : null,
      source: "invoice" as const,
      meta: {
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        amount: inv.amount,
        dueDate: inv.dueDate,
      },
    }));
  } catch (_) { /* silent */ }

  // Group messages from athletes (unread)
  let groupMsgAthleteNotifs: any[] = [];
  try {
    const proGroups = await (prisma as any).athleteGroupMember.findMany({
      where: { professionnelId: proId },
      select: { conversationId: true, conversation: { select: { name: true } } },
    });
    if (proGroups.length > 0) {
      const groupIds = proGroups.map((g: any) => g.conversationId);
      const groupNameMap = new Map(proGroups.map((g: any) => [g.conversationId, g.conversation?.name]));

      const unreadGroupMsgs = await (prisma as any).athleteGroupMessage.findMany({
        where: {
          conversationId: { in: groupIds },
          senderType: "athlete",
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

      groupMsgAthleteNotifs = Array.from(byGroup.entries()).map(([convId, g]) => ({
        id: `grp-ath-msg-${convId}`,
        title: `Message de l'athlète`,
        subtitle: g.count === 1
          ? (g.lastMsg.content?.slice(0, 80) || "Pièce jointe")
          : `${g.count} nouveaux messages`,
        date: g.lastMsg.createdAt,
        type: "group_message_athlete",
        color: "orange",
        source: "group_message" as const,
        meta: {
          conversationId: convId,
          groupName: groupNameMap.get(convId) || "Groupe",
          preview: g.lastMsg.content?.slice(0, 120) || "",
          count: g.count,
        },
      }));
    }
  } catch (_) { /* silent */ }

  return [...delayNotifs, ...acceptedNotifs, ...visioJoinNotifs, ...newBookingNotifs, ...cancelledByAthleteNotifs, ...paymentReceivedNotifs, ...paymentFailedNotifs, ...consultPrepNotifs, ...athleteFeedbackNotifs, ...medAlertNotifs, ...kineAlertNotifs, ...nutriAlertNotifs, ...athleteDocNotifs, ...exerciseLogNotifs, ...dataAccessNotifs, ...securityNotifs, ...connectionNotifs, ...connRejectedNotifs, ...messageNotifs, ...athleteMessageNotifs, ...groupMsgAthleteNotifs, ...inviteNotifs, ...invoiceOverdueNotifs, ...dueEvents, ...dueTasks, ...overdueNotifs];
}

// ─── Simple hash for change detection ───

function quickHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash + c) | 0;
  }
  return hash.toString(36);
}

// ─── SSE endpoint ───

const POLL_INTERVAL_MS = 5000; // Poll DB every 5s
const HEARTBEAT_INTERVAL_MS = 30000; // Keep-alive every 30s

export async function GET(req: NextRequest) {
  // Authenticate via session cookie
  const session = await getSessionPro();
  if (!session) {
    return new Response(JSON.stringify({ error: "Non authentifié" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const proId = session.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastHash = "";
      let alive = true;

      // Send initial comment to establish connection
      controller.enqueue(encoder.encode(": connected\n\n"));

      const poll = async () => {
        if (!alive) return;
        try {
          const data = await getNotificationsForPro(proId);
          const json = JSON.stringify(data);
          const hash = quickHash(json);

          if (hash !== lastHash) {
            lastHash = hash;
            controller.enqueue(encoder.encode(`data: ${json}\n\n`));
          }
        } catch (err) {
          console.error("[SSE notifications] poll error:", err);
        }
      };

      // Initial fetch immediately
      poll();

      // Poll on interval
      const pollTimer = setInterval(poll, POLL_INTERVAL_MS);

      // Heartbeat to keep connection alive (nginx/proxy timeouts)
      const heartbeatTimer = setInterval(() => {
        if (!alive) return;
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          alive = false;
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Cleanup on client disconnect
      req.signal.addEventListener("abort", () => {
        alive = false;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
