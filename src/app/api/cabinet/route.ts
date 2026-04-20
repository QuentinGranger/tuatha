import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { audit } from "@/lib/auditLog";
import { revokeAllSessions } from "@/lib/session";
import { writeAdminLog } from "@/lib/adminLog";
import { softDelete } from "@/lib/softDelete";
import { sanitizeBody } from "@/lib/sanitize";

// ─── GET /api/cabinet — list cabinets the pro belongs to ───
export const GET = withAuth(async (_request, ctx) => {
  try {
    const proId = ctx.session.id;

    // Cabinets where the pro is owner OR member
    const memberships = await (prisma as any).cabinetMember.findMany({
      where: { proId },
      include: {
        cabinet: {
          include: {
            owner: { select: { id: true, nom: true, prenom: true, specialite: true } },
            members: {
              include: {
                professionnel: {
                  select: { id: true, nom: true, prenom: true, email: true, specialite: true },
                },
              },
            },
          },
        },
      },
    });

    const cabinets = memberships.map((m: any) => ({
      ...m.cabinet,
      myRole: m.role,
    }));

    return NextResponse.json(cabinets);
  } catch (error) {
    console.error("GET /api/cabinet error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "cabinet" });

// ─── POST /api/cabinet — create cabinet or manage members ───
export const POST = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;
    const body = sanitizeBody(await request.json());
    const { action } = body;

    // ──────────────────────────────────────────
    // CREATE CABINET
    // ──────────────────────────────────────────
    if (action === "create") {
      const { name, address } = body;
      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json({ error: "Nom du cabinet requis (min 2 caractères)" }, { status: 400 });
      }

      const cabinet = await (prisma as any).cabinet.create({
        data: {
          name: name.trim(),
          address: address?.trim() || null,
          ownerId: proId,
          members: {
            create: { proId, role: "admin" },
          },
        },
        include: {
          members: {
            include: {
              professionnel: {
                select: { id: true, nom: true, prenom: true, email: true, specialite: true },
              },
            },
          },
        },
      });

      audit.logCreate("cabinet", cabinet.id, proId, { name: cabinet.name });
      await writeAdminLog({ cabinetId: cabinet.id, actorProId: proId, action: "cabinet_created", details: { name: cabinet.name, address: cabinet.address }, ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null });
      return NextResponse.json(cabinet, { status: 201 });
    }

    // ──────────────────────────────────────────
    // ADD MEMBER (admin only)
    // ──────────────────────────────────────────
    if (action === "addMember") {
      const { cabinetId, email, role } = body;
      if (!cabinetId || !email) {
        return NextResponse.json({ error: "cabinetId et email requis" }, { status: 400 });
      }

      // Verify caller is admin of this cabinet
      const callerMembership = await (prisma as any).cabinetMember.findUnique({
        where: { cabinetId_proId: { cabinetId, proId } },
      });
      if (!callerMembership || callerMembership.role !== "admin") {
        return NextResponse.json({ error: "Seuls les administrateurs peuvent ajouter des membres" }, { status: 403 });
      }

      // Find the target pro by email
      const targetPro = await prisma.professionnel.findUnique({
        where: { email },
        select: { id: true, nom: true, prenom: true, email: true, specialite: true },
      });
      if (!targetPro) {
        return NextResponse.json({ error: "Aucun professionnel trouvé avec cet email" }, { status: 404 });
      }

      // Check if already a member
      const existing = await (prisma as any).cabinetMember.findUnique({
        where: { cabinetId_proId: { cabinetId, proId: targetPro.id } },
      });
      if (existing) {
        return NextResponse.json({ error: "Ce professionnel est déjà membre du cabinet" }, { status: 409 });
      }

      const memberRole = role === "admin" ? "admin" : "member";
      const member = await (prisma as any).cabinetMember.create({
        data: { cabinetId, proId: targetPro.id, role: memberRole },
        include: {
          professionnel: {
            select: { id: true, nom: true, prenom: true, email: true, specialite: true },
          },
        },
      });

      audit.logCreate("cabinetMember", member.id, proId, {
        cabinetId,
        targetProId: targetPro.id,
        role: memberRole,
      });
      await writeAdminLog({ cabinetId, actorProId: proId, action: "member_added", targetProId: targetPro.id, details: { email, role: memberRole, name: `${targetPro.prenom} ${targetPro.nom}` }, ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null });

      return NextResponse.json(member, { status: 201 });
    }

    // ──────────────────────────────────────────
    // REMOVE MEMBER (admin only)
    // ──────────────────────────────────────────
    if (action === "removeMember") {
      const { cabinetId, memberId } = body;
      if (!cabinetId || !memberId) {
        return NextResponse.json({ error: "cabinetId et memberId requis" }, { status: 400 });
      }

      // Verify caller is admin
      const callerMembership = await (prisma as any).cabinetMember.findUnique({
        where: { cabinetId_proId: { cabinetId, proId } },
      });
      if (!callerMembership || callerMembership.role !== "admin") {
        return NextResponse.json({ error: "Seuls les administrateurs peuvent retirer des membres" }, { status: 403 });
      }

      // Find the member to remove
      const targetMember = await (prisma as any).cabinetMember.findUnique({
        where: { id: memberId },
      });
      if (!targetMember || targetMember.cabinetId !== cabinetId) {
        return NextResponse.json({ error: "Membre introuvable dans ce cabinet" }, { status: 404 });
      }

      // Cannot remove yourself if you're the last admin
      if (targetMember.proId === proId) {
        const adminCount = await (prisma as any).cabinetMember.count({
          where: { cabinetId, role: "admin" },
        });
        if (adminCount <= 1) {
          return NextResponse.json({
            error: "Impossible de vous retirer : vous êtes le seul administrateur. Nommez un autre admin d'abord.",
          }, { status: 400 });
        }
      }

      // ─── CRITICAL: Athletes stay with their original pro ───
      // We ONLY remove the cabinet membership. No athlete data is touched.
      // The removed pro's athletes remain linked to them via professionnelId.
      audit.logDelete("cabinetMember", memberId, proId, {
        cabinetId,
        removedProId: targetMember.proId,
      });

      await (prisma as any).cabinetMember.delete({ where: { id: memberId } });
      await writeAdminLog({ cabinetId, actorProId: proId, action: "member_removed", targetProId: targetMember.proId, details: { memberId }, ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null });

      return NextResponse.json({ ok: true });
    }

    // ──────────────────────────────────────────
    // CHANGE MEMBER ROLE (admin only)
    // ──────────────────────────────────────────
    if (action === "changeRole") {
      const { cabinetId, memberId, newRole } = body;
      if (!cabinetId || !memberId || !newRole) {
        return NextResponse.json({ error: "cabinetId, memberId et newRole requis" }, { status: 400 });
      }
      if (!["admin", "member"].includes(newRole)) {
        return NextResponse.json({ error: "Rôle invalide (admin ou member)" }, { status: 400 });
      }

      // Verify caller is admin
      const callerMembership = await (prisma as any).cabinetMember.findUnique({
        where: { cabinetId_proId: { cabinetId, proId } },
      });
      if (!callerMembership || callerMembership.role !== "admin") {
        return NextResponse.json({ error: "Seuls les administrateurs peuvent changer les rôles" }, { status: 403 });
      }

      const targetMember = await (prisma as any).cabinetMember.findUnique({
        where: { id: memberId },
      });
      if (!targetMember || targetMember.cabinetId !== cabinetId) {
        return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
      }

      // Prevent demoting yourself if you're the last admin
      if (targetMember.proId === proId && newRole === "member") {
        const adminCount = await (prisma as any).cabinetMember.count({
          where: { cabinetId, role: "admin" },
        });
        if (adminCount <= 1) {
          return NextResponse.json({
            error: "Impossible de rétrograder : vous êtes le seul administrateur.",
          }, { status: 400 });
        }
      }

      const updated = await (prisma as any).cabinetMember.update({
        where: { id: memberId },
        data: { role: newRole },
        include: {
          professionnel: {
            select: { id: true, nom: true, prenom: true, email: true, specialite: true },
          },
        },
      });

      audit.logUpdate("cabinetMember", memberId, proId, {
        cabinetId,
        oldRole: targetMember.role,
        newRole,
      });
      await writeAdminLog({ cabinetId, actorProId: proId, action: "role_changed", targetProId: targetMember.proId, details: { oldRole: targetMember.role, newRole, memberId }, ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null });

      return NextResponse.json(updated);
    }

    // ──────────────────────────────────────────
    // OFFBOARD MEMBER (admin only)
    // Cuts access immediately + reassigns shared followups
    // ──────────────────────────────────────────
    if (action === "offboard") {
      const { cabinetId, memberId, reassignToProId } = body;
      if (!cabinetId || !memberId) {
        return NextResponse.json({ error: "cabinetId et memberId requis" }, { status: 400 });
      }

      // Verify caller is admin
      const callerMembership = await (prisma as any).cabinetMember.findUnique({
        where: { cabinetId_proId: { cabinetId, proId } },
      });
      if (!callerMembership || callerMembership.role !== "admin") {
        return NextResponse.json({ error: "Seuls les administrateurs peuvent effectuer un offboarding" }, { status: 403 });
      }

      // Find the member to offboard
      const targetMember = await (prisma as any).cabinetMember.findUnique({
        where: { id: memberId },
        include: { professionnel: { select: { id: true, nom: true, prenom: true, email: true } } },
      });
      if (!targetMember || targetMember.cabinetId !== cabinetId) {
        return NextResponse.json({ error: "Membre introuvable dans ce cabinet" }, { status: 404 });
      }

      const offboardedProId = targetMember.proId;

      // Cannot offboard yourself
      if (offboardedProId === proId) {
        return NextResponse.json({ error: "Vous ne pouvez pas effectuer votre propre offboarding" }, { status: 400 });
      }

      // Determine who receives reassigned followups
      let reassignTo = proId; // default: admin doing the offboarding
      if (reassignToProId) {
        // Verify the target is a member of the same cabinet
        const reassignMember = await (prisma as any).cabinetMember.findUnique({
          where: { cabinetId_proId: { cabinetId, proId: reassignToProId } },
        });
        if (!reassignMember) {
          return NextResponse.json({ error: "Le professionnel de réassignation n'est pas membre du cabinet" }, { status: 400 });
        }
        reassignTo = reassignToProId;
      }

      const report: Record<string, unknown> = {
        offboardedProId,
        offboardedName: `${targetMember.professionnel.prenom} ${targetMember.professionnel.nom}`,
        offboardedEmail: targetMember.professionnel.email,
        reassignedTo: reassignTo,
        cabinetId,
      };

      // ─── STEP 1: Revoke ALL sessions immediately ───
      const revokedCount = await revokeAllSessions(offboardedProId);
      report.sessionsRevoked = revokedCount;
      console.log(`[OFFBOARD] Revoked ${revokedCount} sessions for pro=${offboardedProId}`);

      // ─── STEP 2: Reassign ProConnections where offboarded pro is connectedPro ───
      // These are shared accesses the offboarded pro had to other pros' athletes
      const connectionsAsConnected = await (prisma as any).proConnection.updateMany({
        where: { connectedProId: offboardedProId, status: "connecte" },
        data: { connectedProId: reassignTo },
      });
      report.connectionsReassignedAsConnected = connectionsAsConnected.count;

      // ─── STEP 3: Reassign ProConnections where offboarded pro is ownerPro ───
      // These are connections the offboarded pro created (invited others to see their athletes)
      const connectionsAsOwner = await (prisma as any).proConnection.updateMany({
        where: { ownerProId: offboardedProId, status: "connecte" },
        data: { ownerProId: reassignTo },
      });
      report.connectionsReassignedAsOwner = connectionsAsOwner.count;

      // ─── STEP 4: Cancel pending invitations sent by offboarded pro ───
      const cancelledInvites = await (prisma as any).proInvitation.updateMany({
        where: { senderProId: offboardedProId, status: "envoyee" },
        data: { status: "annulee" },
      });
      report.invitationsCancelled = cancelledInvites.count;

      // ─── STEP 5: Remove cabinet membership ───
      await (prisma as any).cabinetMember.delete({ where: { id: memberId } });
      report.membershipRemoved = true;

      // ─── Audit trail ───
      audit.logDelete("offboarding", offboardedProId, proId, report);
      await writeAdminLog({ cabinetId, actorProId: proId, action: "offboarding", targetProId: offboardedProId, details: report, ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null });
      console.log(`[OFFBOARD] Complete for pro=${offboardedProId} by admin=${proId}`, report);

      return NextResponse.json({
        ok: true,
        offboarding: report,
      });
    }

    // ──────────────────────────────────────────
    // TRANSFER ATHLETE — EXPLICITLY BLOCKED
    // ──────────────────────────────────────────
    if (action === "transferAthlete" || action === "absorbAthlete" || action === "claimAthlete") {
      console.warn(`[CABINET] Blocked athlete transfer attempt by pro=${proId} action=${action}`);
      return NextResponse.json({
        error: "Le transfert d'athlètes entre membres n'est pas autorisé. Chaque professionnel conserve ses propres athlètes.",
        code: "ATHLETE_TRANSFER_BLOCKED",
      }, { status: 403 });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/cabinet error:", error?.message || error, error?.code, error?.meta);
    return NextResponse.json({ error: "Erreur serveur", detail: error?.message || String(error) }, { status: 500 });
  }
}, { resource: "cabinet" });

// ─── PUT /api/cabinet — update cabinet info (admin only) ───
export const PUT = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;
    const body = sanitizeBody(await request.json());
    const { cabinetId, name, address } = body;

    if (!cabinetId) {
      return NextResponse.json({ error: "cabinetId requis" }, { status: 400 });
    }

    // Verify caller is admin
    const callerMembership = await (prisma as any).cabinetMember.findUnique({
      where: { cabinetId_proId: { cabinetId, proId } },
    });
    if (!callerMembership || callerMembership.role !== "admin") {
      return NextResponse.json({ error: "Seuls les administrateurs peuvent modifier le cabinet" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length < 2) {
        return NextResponse.json({ error: "Nom invalide (min 2 caractères)" }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (address !== undefined) updateData.address = address?.trim() || null;

    const updated = await (prisma as any).cabinet.update({
      where: { id: cabinetId },
      data: updateData,
    });

    audit.logUpdate("cabinet", cabinetId, proId, updateData);
    await writeAdminLog({ cabinetId, actorProId: proId, action: "cabinet_updated", details: updateData, ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/cabinet error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "cabinet" });

// ─── DELETE /api/cabinet — delete cabinet (admin only) ───
export const DELETE = withAuth(async (request, ctx) => {
  try {
    const proId = ctx.session.id;
    const { cabinetId } = await request.json();

    if (!cabinetId) {
      return NextResponse.json({ error: "cabinetId requis" }, { status: 400 });
    }

    // Only the original owner can delete the cabinet
    const cabinet = await (prisma as any).cabinet.findUnique({ where: { id: cabinetId } });
    if (!cabinet) {
      return NextResponse.json({ error: "Cabinet introuvable" }, { status: 404 });
    }
    if (cabinet.ownerId !== proId) {
      return NextResponse.json({
        error: "Seul le créateur du cabinet peut le supprimer",
      }, { status: 403 });
    }

    // ─── CRITICAL: Athletes are NOT touched on cabinet deletion ───
    // CabinetMember records are cascaded, but athletes stay with their pros.
    audit.logDelete("cabinet", cabinetId, proId, {
      name: cabinet.name,
      memberCount: await (prisma as any).cabinetMember.count({ where: { cabinetId } }),
    });

    // Log before delete (cabinet will be gone after)
    await writeAdminLog({ cabinetId, actorProId: proId, action: "cabinet_deleted", details: { name: cabinet.name }, ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null });

    await softDelete("cabinet", cabinetId, proId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/cabinet error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "cabinet" });
