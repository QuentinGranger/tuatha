import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { prisma } from "@/lib/prisma";

/* ─── Helpers ─── */
function parseMetadata(outcome: string | null): Record<string, any> {
  if (!outcome) return {};
  try { return JSON.parse(outcome); } catch { return { postMortem: outcome }; }
}

function buildMetadata(existing: Record<string, any>, updates: Record<string, any>): string {
  return JSON.stringify({ ...existing, ...updates });
}

function generateIncidentId(createdAt: Date, index: number): string {
  const y = createdAt.getFullYear();
  const n = String(index).padStart(3, "0");
  return `INC-${y}-${n}`;
}

/* ─── GET: List or Detail ─── */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // ── Detail view ──
    if (id) {
      const incident = await (prisma as any).investigation.findUnique({
        where: { id },
        include: {
          professionnel: { select: { id: true, prenom: true, nom: true, email: true, specialite: true, accountStatus: true } },
          athleteUser: { select: { id: true, prenom: true, nom: true, email: true } },
        },
      });
      if (!incident) return NextResponse.json({ error: "Incident introuvable." }, { status: 404 });

      // Get related security alerts for this pro
      const relatedAlerts = incident.professionnelId ? await (prisma as any).securityAlert.findMany({
        where: { professionnelId: incident.professionnelId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, type: true, message: true, createdAt: true, resolved: true },
      }) : [];

      const metadata = parseMetadata(incident.outcome);

      return NextResponse.json({
        ...incident,
        metadata,
        relatedAlerts,
        incidentId: generateIncidentId(new Date(incident.createdAt), 1),
      });
    }

    // ── List view ──
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [incidents, stats] = await Promise.all([
      (prisma as any).investigation.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          professionnel: { select: { id: true, prenom: true, nom: true, specialite: true } },
        },
      }),
      Promise.all([
        // Active incidents (open + in_progress)
        (prisma as any).investigation.count({ where: { status: { in: ["open", "in_progress", "pending_info"] } } }),
        // Critical incidents
        (prisma as any).investigation.count({ where: { severity: "critical", status: { in: ["open", "in_progress", "pending_info"] } } }),
        // CNIL notifications pending (active without dpoNotifiedAt)
        (prisma as any).investigation.count({ where: { status: { in: ["open", "in_progress", "pending_info"] }, dpoNotifiedAt: null } }),
        // User notifications pending
        (prisma as any).investigation.count({ where: { status: { in: ["open", "in_progress", "pending_info"] }, userNotifiedAt: null } }),
        // Yesterday active count (for comparison)
        (prisma as any).investigation.count({ where: { status: { in: ["open", "in_progress", "pending_info"] }, createdAt: { lt: twentyFourHoursAgo } } }),
        // Closed in last 7 days (for avg resolution time)
        (prisma as any).investigation.findMany({ where: { closedAt: { not: null, gte: sevenDaysAgo } }, select: { createdAt: true, closedAt: true } }),
      ]),
    ]);

    const [activeCount, criticalCount, cnilPending, userNotifPending, yesterdayActive, recentClosed] = stats;

    // Calculate avg resolution time
    let avgResolutionHours = 0;
    if (recentClosed.length > 0) {
      const totalMs = recentClosed.reduce((sum: number, i: any) => sum + (new Date(i.closedAt).getTime() - new Date(i.createdAt).getTime()), 0);
      avgResolutionHours = Math.round(totalMs / recentClosed.length / 3600000);
    }

    // Estimate affected users from metadata
    let totalAffectedUsers = 0;
    const enrichedIncidents = incidents.map((inc: any, idx: number) => {
      const metadata = parseMetadata(inc.outcome);
      const affectedUsers = metadata.affectedUsersCount ?? 0;
      totalAffectedUsers += affectedUsers;
      return {
        ...inc,
        metadata,
        affectedUsersCount: affectedUsers,
        affectedData: metadata.affectedData ?? [],
        incidentId: generateIncidentId(new Date(inc.createdAt), incidents.length - idx),
      };
    });

    return NextResponse.json({
      incidents: enrichedIncidents,
      stats: {
        activeCount,
        criticalCount,
        totalAffectedUsers,
        cnilPending,
        userNotifPending,
        avgResolutionHours,
        activeChange: activeCount - yesterdayActive,
      },
    });
  } catch (error) {
    console.error("[ADMIN-INCIDENTS] GET Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

/* ─── POST: Actions ─── */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  try {
    const body = await req.json();
    const { action, incidentId, ...payload } = body;

    switch (action) {
      case "create": {
        const { title, description, severity, type, professionnelId, affectedData, affectedUsersCount } = payload;
        const metadata = { affectedData: affectedData ?? [], affectedUsersCount: affectedUsersCount ?? 0, timeline: [`${new Date().toISOString()}|Incident créé par ${session.email}`] };
        const incident = await (prisma as any).investigation.create({
          data: {
            title: title || "Nouvel incident",
            description: description || "",
            type: type || "security",
            severity: severity || "medium",
            status: "open",
            openedBy: session.email,
            assignedTo: session.email,
            professionnelId: professionnelId || null,
            actionsTaken: ["incident_opened"],
            outcome: JSON.stringify(metadata),
          },
        });
        return NextResponse.json({ success: true, message: "Incident créé.", incident });
      }

      case "update_status": {
        if (!incidentId) return NextResponse.json({ error: "incidentId requis." }, { status: 400 });
        const { status } = payload;
        const updateData: any = { status };
        if (status === "closed_resolved" || status === "closed_unfounded") {
          updateData.closedAt = new Date();
          updateData.closedBy = session.email;
        }
        await (prisma as any).investigation.update({ where: { id: incidentId }, data: updateData });
        // Add timeline entry
        const current = await (prisma as any).investigation.findUnique({ where: { id: incidentId }, select: { outcome: true } });
        const meta = parseMetadata(current?.outcome);
        const timeline = meta.timeline ?? [];
        timeline.push(`${new Date().toISOString()}|Statut changé en "${status}" par ${session.email}`);
        await (prisma as any).investigation.update({ where: { id: incidentId }, data: { outcome: buildMetadata(meta, { timeline }) } });
        return NextResponse.json({ success: true, message: `Statut mis à jour: ${status}` });
      }

      case "update_severity": {
        if (!incidentId) return NextResponse.json({ error: "incidentId requis." }, { status: 400 });
        const { severity } = payload;
        await (prisma as any).investigation.update({ where: { id: incidentId }, data: { severity } });
        return NextResponse.json({ success: true, message: `Gravité mise à jour: ${severity}` });
      }

      case "assign": {
        if (!incidentId) return NextResponse.json({ error: "incidentId requis." }, { status: 400 });
        const { assignedTo } = payload;
        await (prisma as any).investigation.update({ where: { id: incidentId }, data: { assignedTo: assignedTo || session.email } });
        return NextResponse.json({ success: true, message: `Assigné à ${assignedTo || session.email}` });
      }

      case "add_timeline": {
        if (!incidentId) return NextResponse.json({ error: "incidentId requis." }, { status: 400 });
        const { event } = payload;
        const inc = await (prisma as any).investigation.findUnique({ where: { id: incidentId }, select: { outcome: true, actionsTaken: true } });
        const meta = parseMetadata(inc?.outcome);
        const timeline = meta.timeline ?? [];
        timeline.push(`${new Date().toISOString()}|${event}`);
        await (prisma as any).investigation.update({
          where: { id: incidentId },
          data: {
            outcome: buildMetadata(meta, { timeline }),
            actionsTaken: [...(inc?.actionsTaken ?? []), event.slice(0, 50)],
          },
        });
        return NextResponse.json({ success: true, message: "Événement ajouté à la timeline." });
      }

      case "update_metadata": {
        if (!incidentId) return NextResponse.json({ error: "incidentId requis." }, { status: 400 });
        const inc = await (prisma as any).investigation.findUnique({ where: { id: incidentId }, select: { outcome: true } });
        const meta = parseMetadata(inc?.outcome);
        const newMeta = buildMetadata(meta, payload.metadata ?? {});
        await (prisma as any).investigation.update({ where: { id: incidentId }, data: { outcome: newMeta } });
        return NextResponse.json({ success: true, message: "Métadonnées mises à jour." });
      }

      case "notify_cnil": {
        if (!incidentId) return NextResponse.json({ error: "incidentId requis." }, { status: 400 });
        const inc = await (prisma as any).investigation.findUnique({ where: { id: incidentId }, select: { outcome: true } });
        const meta = parseMetadata(inc?.outcome);
        const timeline = meta.timeline ?? [];
        timeline.push(`${new Date().toISOString()}|Notification CNIL envoyée par ${session.email}`);
        await (prisma as any).investigation.update({
          where: { id: incidentId },
          data: {
            dpoNotifiedAt: new Date(),
            outcome: buildMetadata(meta, {
              timeline,
              cnilDecision: { notified: true, date: new Date().toISOString(), by: session.email, notes: payload.notes ?? "" },
            }),
          },
        });
        return NextResponse.json({ success: true, message: "CNIL notifiée. DPO informé." });
      }

      case "notify_users": {
        if (!incidentId) return NextResponse.json({ error: "incidentId requis." }, { status: 400 });
        const inc = await (prisma as any).investigation.findUnique({ where: { id: incidentId }, select: { outcome: true } });
        const meta = parseMetadata(inc?.outcome);
        const timeline = meta.timeline ?? [];
        timeline.push(`${new Date().toISOString()}|Notification utilisateurs envoyée par ${session.email}`);
        await (prisma as any).investigation.update({
          where: { id: incidentId },
          data: {
            userNotifiedAt: new Date(),
            outcome: buildMetadata(meta, {
              timeline,
              userNotification: { notified: true, date: new Date().toISOString(), by: session.email, message: payload.message ?? "" },
            }),
          },
        });
        return NextResponse.json({ success: true, message: "Utilisateurs notifiés." });
      }

      case "save_postmortem": {
        if (!incidentId) return NextResponse.json({ error: "incidentId requis." }, { status: 400 });
        const inc = await (prisma as any).investigation.findUnique({ where: { id: incidentId }, select: { outcome: true } });
        const meta = parseMetadata(inc?.outcome);
        await (prisma as any).investigation.update({
          where: { id: incidentId },
          data: { outcome: buildMetadata(meta, { postMortem: payload.postMortem ?? "" }) },
        });
        return NextResponse.json({ success: true, message: "Post-mortem enregistré." });
      }

      default:
        return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[ADMIN-INCIDENTS] POST Error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
