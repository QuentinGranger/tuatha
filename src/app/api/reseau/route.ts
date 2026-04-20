import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { sendInviteEmail } from "@/lib/email";
import { renewConnection, updateConnectionDataScopes, resolveDataScopes, OWNER_SCOPES, meetsActionLevel } from "@/lib/abac";
import { validateBody, reseauPatchSchema } from "@/lib/validation";
import { signAvatarPaths } from "@/lib/signedUrl";
import { sanitizeNote, sanitizeMessage, sanitizeBody } from "@/lib/sanitize";
import { audit } from "@/lib/auditLog";
import { checkSharingConsent } from "@/lib/consentCheck";

// GET /api/reseau?athleteId=xxx — get connections, invitations, collab notes for an athlete
export const GET = withAuth(async (request, ctx) => {
  try {
    const session = ctx.session;

    const athleteId = request.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    // Find the selected athlete's name to also match duplicate records (same person, different pro)
    const selectedAthlete = await (prisma as any).athlete.findUnique({ where: { id: athleteId }, select: { name: true } });
    let athleteIds = [athleteId];
    if (selectedAthlete) {
      const sameNameAthletes = await (prisma as any).athlete.findMany({
        where: { name: { equals: selectedAthlete.name, mode: "insensitive" } },
        select: { id: true },
      });
      athleteIds = [...new Set(sameNameAthletes.map((a: any) => a.id))] as string[];
    }

    const proSelect = { id: true, nom: true, prenom: true, specialite: true, avatarPath: true, email: true, telephone: true };

    // Fetch connections where I am owner OR connected party, across all matching athlete IDs
    const [connectionsAsOwner, connectionsAsConnected, invitations, notes] = await Promise.all([
      (prisma as any).proConnection.findMany({
        where: { athleteId: { in: athleteIds }, ownerProId: session.id },
        include: { connectedPro: { select: proSelect }, ownerPro: { select: proSelect } },
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).proConnection.findMany({
        where: { athleteId: { in: athleteIds }, connectedProId: session.id },
        include: { connectedPro: { select: proSelect }, ownerPro: { select: proSelect } },
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).proInvitation.findMany({
        where: { athleteId: { in: athleteIds }, senderProId: session.id },
        orderBy: { createdAt: "desc" },
      }),
      (prisma as any).collabNote.findMany({
        where: { athleteId: { in: athleteIds } },
        include: {
          authorPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    // Normalize connections and add context flags
    // isOwner = true  → I invited this pro, permissions = what I gave them
    // isOwner = false → This pro invited me, permissions = what they gave me (what I can see)
    const normalizedOwner = connectionsAsOwner.map((c: any) => {
      const scopes = OWNER_SCOPES;
      return {
        ...c,
        isOwner: true,
        dataScopes: scopes,
        myPermissions: {
          readProgramme: meetsActionLevel(scopes.entrainement, "read"),
          readIndicateurs: meetsActionLevel(scopes.indicateurs, "read"),
          readBlessures: meetsActionLevel(scopes.blessures, "read"),
          readDocuments: meetsActionLevel(scopes.documents, "read"),
        },
      };
    });

    const normalizedAsConnected = connectionsAsConnected.map((c: any) => {
      const scopes = resolveDataScopes(c);
      return {
        ...c,
        connectedPro: c.ownerPro, // show the owner as "the other pro"
        isOwner: false,
        dataScopes: scopes,
        myPermissions: {
          readProgramme: meetsActionLevel(scopes.entrainement, "read"),
          readIndicateurs: meetsActionLevel(scopes.indicateurs, "read"),
          readBlessures: meetsActionLevel(scopes.blessures, "read"),
          readDocuments: meetsActionLevel(scopes.documents, "read"),
        },
      };
    });

    // Deduplicate by id
    const allMap = new Map<string, any>();
    for (const c of normalizedOwner) allMap.set(c.id, c);
    for (const c of normalizedAsConnected) allMap.set(c.id, c);
    const connections = Array.from(allMap.values());

    return NextResponse.json(signAvatarPaths({ connections, invitations, notes }));
  } catch (error) {
    console.error("GET /api/reseau error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });

// POST /api/reseau — actions: invite, addNote, addConnection
export const POST = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const body = sanitizeBody(await request.json());
    const { action } = body;

    if (action === "invite") {
      const { athleteId, email, role, message } = body;
      if (!athleteId || !email) return NextResponse.json({ error: "athleteId et email requis" }, { status: 400 });

      // Consent check: athlete must have consented to external sharing
      const consent = await checkSharingConsent(athleteId);
      if (!consent.granted) {
        return NextResponse.json({ error: consent.reason, consentRequired: true }, { status: 403 });
      }

      // Sanitize optional invite message
      let safeMessage: string | null = null;
      if (message) {
        const s = sanitizeMessage(message);
        if (!s.ok) return NextResponse.json({ error: s.reason }, { status: 400 });
        safeMessage = s.text;
      }

      const athlete = await (prisma as any).athlete.findUnique({ where: { id: athleteId }, select: { name: true } });
      const proRecord = await (prisma as any).professionnel.findUnique({ where: { id: pro.id }, select: { nom: true, prenom: true, specialite: true } });

      // Generate crypto-random token (URL-safe, 48 bytes → 64 chars base64url)
      const token = randomBytes(48).toString("base64url");
      // Invitation expires in 7 days
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await (prisma as any).proInvitation.create({
        data: {
          athleteId,
          senderProId: pro.id,
          email,
          role: role || "Autre",
          message: safeMessage,
          token,
          expiresAt,
        },
      });

      // Send real email via Resend
      try {
        await sendInviteEmail({
          to: email,
          inviteId: invite.id,
          inviteToken: invite.token,
          senderName: proRecord ? `${proRecord.prenom} ${proRecord.nom}` : "Un professionnel",
          senderSpecialite: proRecord?.specialite || pro.specialite,
          athleteName: athlete?.name || "Patient",
          role: role || "Autre",
          message: safeMessage,
          expiresAt: invite.expiresAt,
        });
      } catch (emailErr) {
        console.error("Email send failed (invite saved anyway):", emailErr);
      }

      return NextResponse.json(invite, { status: 201 });
    }

    if (action === "addNote") {
      const { athleteId, content, type, tags } = body;
      if (!athleteId || !content) return NextResponse.json({ error: "athleteId et content requis" }, { status: 400 });

      // Sanitize note content
      const sanitized = sanitizeNote(content);
      if (!sanitized.ok) return NextResponse.json({ error: sanitized.reason }, { status: 400 });

      const note = await (prisma as any).collabNote.create({
        data: {
          athleteId,
          authorProId: pro.id,
          content: sanitized.text,
          type: type || "note",
          tags: tags || [],
        },
        include: {
          authorPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      });
      audit.logCreate("collabNote", note.id, pro.id, { content: sanitized.text, athleteId, type: type || "note" });
      return NextResponse.json(signAvatarPaths(note), { status: 201 });
    }

    if (action === "replyNote") {
      const { athleteId, content, parentId, tags } = body;
      if (!athleteId || !content) return NextResponse.json({ error: "athleteId et content requis" }, { status: 400 });

      // Sanitize reply content
      const sanitized = sanitizeNote(content);
      if (!sanitized.ok) return NextResponse.json({ error: sanitized.reason }, { status: 400 });

      const note = await (prisma as any).collabNote.create({
        data: {
          athleteId,
          authorProId: pro.id,
          content: sanitized.text,
          type: "reponse",
          tags: tags || [],
          parentId: parentId || null,
        },
        include: {
          authorPro: { select: { id: true, nom: true, prenom: true, specialite: true, avatarPath: true } },
        },
      });
      audit.logCreate("collabNote", note.id, pro.id, { content: sanitized.text, athleteId, type: "reponse", parentId });
      return NextResponse.json(signAvatarPaths(note), { status: 201 });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/reseau error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });

// PATCH /api/reseau — update permissions, invite status, pin note
export const PATCH = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const parsed = validateBody(sanitizeBody(await request.json()), reseauPatchSchema);
    if (!parsed.success) return parsed.errorResponse;
    const body = parsed.data;

    if (body.action === "updatePermissions") {
      const { connectionId, ...perms } = body;
      const data: Record<string, unknown> = {};
      const boolFields = ["readProgramme", "readIndicateurs", "readBlessures", "readDocuments", "writeNote", "writeProgramme", "writeValidation"] as const;
      for (const f of boolFields) {
        if ((perms as any)[f] !== undefined) data[f] = (perms as any)[f];
      }
      if (perms.scope) data.scope = perms.scope;

      const conn = await (prisma as any).proConnection.update({
        where: { id: connectionId },
        data,
      });
      return NextResponse.json(conn);
    }

    if (body.action === "updateInvite") {
      const invite = await (prisma as any).proInvitation.update({
        where: { id: body.inviteId },
        data: { status: body.status },
      });
      return NextResponse.json(invite);
    }

    if (body.action === "updateConnection") {
      const conn = await (prisma as any).proConnection.update({
        where: { id: body.connectionId },
        data: { status: body.status },
      });
      return NextResponse.json(conn);
    }

    if (body.action === "pinNote") {
      const before = await (prisma as any).collabNote.findUnique({ where: { id: body.noteId }, select: { pinned: true } });
      const note = await (prisma as any).collabNote.update({
        where: { id: body.noteId },
        data: { pinned: body.pinned },
      });
      audit.logUpdate("collabNote", body.noteId, pro.id, { pinned: { before: before?.pinned, after: body.pinned } });
      return NextResponse.json(note);
    }

    if (body.action === "updateDataScopes") {
      const result = await updateConnectionDataScopes(body.connectionId, pro.id, body.dataScopes);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "renewConnection") {
      const result = await renewConnection(body.connectionId, pro.id, body.days);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      return NextResponse.json({ ok: true, expiresAt: result.expiresAt });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("PATCH /api/reseau error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });

// DELETE /api/reseau — delete connection, invite, or note
export const DELETE = withAuth(async (request, ctx) => {
  try {
    const pro = ctx.session;

    const body = sanitizeBody(await request.json());
    const { action } = body;

    if (action === "deleteConnection") {
      const conn = await (prisma as any).proConnection.findUnique({ where: { id: body.connectionId } });
      if (conn) audit.logDelete("connection", body.connectionId, pro.id, { ownerProId: conn.ownerProId, connectedProId: conn.connectedProId, athleteId: conn.athleteId, status: conn.status });
      await (prisma as any).proConnection.delete({ where: { id: body.connectionId } });
      return NextResponse.json({ ok: true });
    }
    if (action === "deleteInvite") {
      const inv = await (prisma as any).proInvitation.findUnique({ where: { id: body.inviteId } });
      if (inv) audit.logDelete("invitation", body.inviteId, pro.id, { senderProId: inv.senderProId, email: inv.email, athleteId: inv.athleteId, status: inv.status });
      await (prisma as any).proInvitation.delete({ where: { id: body.inviteId } });
      return NextResponse.json({ ok: true });
    }
    if (action === "deleteNote") {
      const note = await (prisma as any).collabNote.findUnique({ where: { id: body.noteId } });
      if (note) audit.logDelete("collabNote", body.noteId, pro.id, { content: note.content, authorProId: note.authorProId, athleteId: note.athleteId, type: note.type, createdAt: note.createdAt });
      await (prisma as any).collabNote.delete({ where: { id: body.noteId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error) {
    console.error("DELETE /api/reseau error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });
