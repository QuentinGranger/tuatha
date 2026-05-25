import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── GET: List tickets + investigations, or single detail ─────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticketId = searchParams.get("id");
  const investigationId = searchParams.get("investigationId");
  const view = searchParams.get("view") ?? "tickets"; // tickets | investigations | all

  // ── Single ticket detail ──
  if (ticketId) {
    const ticket = await (prisma as any).supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        comments: { orderBy: { createdAt: "asc" } },
        professionnel: { select: { id: true, prenom: true, nom: true, email: true, specialite: true } },
        athleteUser: { select: { id: true, prenom: true, nom: true, email: true } },
        investigation: { select: { id: true, title: true, status: true, type: true } },
      },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket introuvable." }, { status: 404 });
    return NextResponse.json(ticket);
  }

  // ── Single investigation detail ──
  if (investigationId) {
    const investigation = await (prisma as any).investigation.findUnique({
      where: { id: investigationId },
      include: {
        professionnel: { select: { id: true, prenom: true, nom: true, email: true, specialite: true } },
        athleteUser: { select: { id: true, prenom: true, nom: true, email: true } },
        tickets: { orderBy: { createdAt: "desc" }, select: { id: true, subject: true, status: true, priority: true, createdAt: true } },
      },
    });
    if (!investigation) return NextResponse.json({ error: "Investigation introuvable." }, { status: 404 });
    return NextResponse.json(investigation);
  }

  // ── List view ──
  const [tickets, investigations, stats] = await Promise.all([
    (view === "investigations") ? [] : (prisma as any).supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, subject: true, category: true, priority: true, status: true,
        createdByRole: true, assignedToId: true, createdAt: true, updatedAt: true,
        resolvedAt: true, blockedReason: true,
        professionnel: { select: { id: true, prenom: true, nom: true } },
        athleteUser: { select: { id: true, prenom: true, nom: true } },
        investigationId: true,
      },
    }),
    (view === "tickets") ? [] : (prisma as any).investigation.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, title: true, type: true, severity: true, status: true,
        openedBy: true, assignedTo: true, createdAt: true, closedAt: true,
        dpoNotifiedAt: true, actionsTaken: true,
        professionnel: { select: { id: true, prenom: true, nom: true } },
        athleteUser: { select: { id: true, prenom: true, nom: true } },
        _count: { select: { tickets: true } },
      },
    }),
    Promise.all([
      (prisma as any).supportTicket.count({ where: { status: { in: ["open", "new"] } } }),
      (prisma as any).supportTicket.count({ where: { status: "in_progress" } }),
      (prisma as any).supportTicket.count({ where: { status: "blocked" } }),
      (prisma as any).supportTicket.count({ where: { priority: { in: ["urgent", "p0", "p1"] } } }),
      (prisma as any).investigation.count({ where: { status: { in: ["open", "in_progress", "pending_info"] } } }),
    ]),
  ]);

  return NextResponse.json({
    tickets,
    investigations,
    stats: {
      open: stats[0],
      inProgress: stats[1],
      blocked: stats[2],
      urgent: stats[3],
      activeInvestigations: stats[4],
    },
  });
}

// ─── POST: Create / Update tickets and investigations ─────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ── Create ticket ──
      case "create_ticket": {
        const { subject, description, category, priority, professionnelId, athleteUserId, investigationId } = body;
        if (!subject || !description || !category) {
          return NextResponse.json({ error: "subject, description et category requis." }, { status: 400 });
        }
        const ticket = await (prisma as any).supportTicket.create({
          data: {
            subject,
            description,
            category,
            priority: priority ?? "normal",
            createdByRole: "admin",
            professionnelId: professionnelId ?? null,
            athleteUserId: athleteUserId ?? null,
            investigationId: investigationId ?? null,
          },
        });
        return NextResponse.json({ success: true, ticket, message: "Ticket créé." });
      }

      // ── Update ticket status ──
      case "update_ticket": {
        const { ticketId, status, assignedToId, resolution, blockedReason, priority } = body;
        if (!ticketId) return NextResponse.json({ error: "ticketId requis." }, { status: 400 });
        const data: any = {};
        if (status) data.status = status;
        if (assignedToId !== undefined) data.assignedToId = assignedToId;
        if (resolution) data.resolution = resolution;
        if (blockedReason) data.blockedReason = blockedReason;
        if (priority) data.priority = priority;
        if (status === "resolved" || status === "closed") data.resolvedAt = new Date();
        const ticket = await (prisma as any).supportTicket.update({ where: { id: ticketId }, data });
        return NextResponse.json({ success: true, ticket, message: "Ticket mis à jour." });
      }

      // ── Add comment to ticket ──
      case "add_comment": {
        const { ticketId, content, internal } = body;
        if (!ticketId || !content) return NextResponse.json({ error: "ticketId et content requis." }, { status: 400 });
        const comment = await (prisma as any).ticketComment.create({
          data: {
            ticketId,
            content,
            authorRole: "admin",
            authorName: "Admin Quentin",
            internal: internal ?? false,
          },
        });
        return NextResponse.json({ success: true, comment, message: "Commentaire ajouté." });
      }

      // ── Create investigation ──
      case "create_investigation": {
        const { title, description, type, severity, professionnelId, athleteUserId, assignedTo } = body;
        if (!title || !description || !type) {
          return NextResponse.json({ error: "title, description et type requis." }, { status: 400 });
        }
        const investigation = await (prisma as any).investigation.create({
          data: {
            title,
            description,
            type,
            severity: severity ?? "medium",
            openedBy: "Admin Quentin",
            assignedTo: assignedTo ?? "Admin Quentin",
            professionnelId: professionnelId ?? null,
            athleteUserId: athleteUserId ?? null,
          },
        });
        return NextResponse.json({ success: true, investigation, message: "Investigation ouverte." });
      }

      // ── Update investigation ──
      case "update_investigation": {
        const { investigationId, status, outcome, assignedTo, actionsTaken, severity } = body;
        if (!investigationId) return NextResponse.json({ error: "investigationId requis." }, { status: 400 });
        const data: any = {};
        if (status) data.status = status;
        if (outcome) data.outcome = outcome;
        if (assignedTo) data.assignedTo = assignedTo;
        if (severity) data.severity = severity;
        if (actionsTaken) data.actionsTaken = actionsTaken;
        if (status?.startsWith("closed")) { data.closedAt = new Date(); data.closedBy = "Admin Quentin"; }
        const investigation = await (prisma as any).investigation.update({ where: { id: investigationId }, data });
        return NextResponse.json({ success: true, investigation, message: "Investigation mise à jour." });
      }

      // ── Notify DPO (marks timestamp + sends email) ──
      case "notify_dpo": {
        const { investigationId } = body;
        if (!investigationId) return NextResponse.json({ error: "investigationId requis." }, { status: 400 });
        const inv = await (prisma as any).investigation.update({
          where: { id: investigationId },
          data: { dpoNotifiedAt: new Date(), actionsTaken: { push: "dpo_notified" } },
        });
        // Send DPO notification email
        try {
          const { sendAdminActionEmail } = await import("@/lib/email");
          await sendAdminActionEmail({
            to: process.env.DPO_EMAIL ?? "dpo@tuatha-app.com",
            prenom: "DPO",
            actionTitle: "Investigation ouverte — Notification DPO",
            actionDescription: `Une investigation nécessite votre attention : "${inv.title}". Veuillez consulter le panneau d'administration pour les détails et actions requises.`,
            actionColor: "#7c3aed",
            details: [
              { label: "ID", value: investigationId.slice(0, 8) },
              { label: "Type", value: inv.type },
              { label: "Sévérité", value: inv.severity },
            ],
          });
        } catch (emailErr) {
          console.error("[DPO] Email notification error:", emailErr);
        }
        console.log(`[DPO] Notification sent for investigation ${investigationId} at ${new Date().toISOString()}`);
        return NextResponse.json({ success: true, message: "DPO notifié par email." });
      }

      // ── Notify user concerned by the investigation ──
      case "notify_user": {
        const { investigationId } = body;
        if (!investigationId) return NextResponse.json({ error: "investigationId requis." }, { status: 400 });
        const inv = await (prisma as any).investigation.findUnique({
          where: { id: investigationId },
          include: {
            professionnel: { select: { email: true, prenom: true } },
            athleteUser: { select: { email: true, prenom: true } },
          },
        });
        if (!inv) return NextResponse.json({ error: "Investigation introuvable." }, { status: 404 });
        const userEmail = inv.professionnel?.email ?? inv.athleteUser?.email;
        const userPrenom = inv.professionnel?.prenom ?? inv.athleteUser?.prenom ?? "Utilisateur";
        if (!userEmail) return NextResponse.json({ error: "Aucun email utilisateur trouvé." }, { status: 400 });
        await (prisma as any).investigation.update({
          where: { id: investigationId },
          data: { userNotifiedAt: new Date(), actionsTaken: { push: "user_notified" } },
        });
        try {
          const { sendAdminActionEmail } = await import("@/lib/email");
          await sendAdminActionEmail({
            to: userEmail,
            prenom: userPrenom,
            actionTitle: "Notification concernant votre compte",
            actionDescription: "Une vérification est en cours concernant votre compte Tuatha. Notre équipe de conformité vous contactera si des informations supplémentaires sont nécessaires. En attendant, votre accès reste inchangé.",
            actionColor: "#0891b2",
            details: [
              { label: "Référence", value: investigationId.slice(0, 8) },
            ],
          });
        } catch (emailErr) {
          console.error("[Investigation] User notification email error:", emailErr);
        }
        return NextResponse.json({ success: true, message: "Utilisateur notifié par email." });
      }

      default:
        return NextResponse.json({ error: `Action inconnue: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error("[ADMIN-TICKETS]", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
