import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAthleteAccess } from "@/lib/withAthleteAccess";
import { sanitizeNote } from "@/lib/sanitize";
import { audit } from "@/lib/auditLog";

// POST /api/athletes/:id/note
export const POST = withAthleteAccess(async (request, ctx, routeCtx) => {
  try {
    const { id } = await routeCtx!.params;
    const body = await request.json();
    const { note, updateContact } = body;

    if (!note || !note.trim()) {
      return NextResponse.json({ error: "La note est requise" }, { status: 400 });
    }

    // Sanitize note content (anti-XSS, anti-injection)
    const sanitized = sanitizeNote(note);
    if (!sanitized.ok) {
      return NextResponse.json({ error: sanitized.reason }, { status: 400 });
    }

    // Only owners can add notes directly
    if (ctx.athleteAccess?.accessType !== "owner") {
      return NextResponse.json({ error: "Seul le professionnel référent peut ajouter des notes." }, { status: 403 });
    }

    // Create note
    const athleteNote = await prisma.athleteNote.create({
      data: {
        note: sanitized.text,
        athleteId: id,
      },
    });

    // Update athlete latestNote + optionally lastContactAt
    const updateData: Record<string, unknown> = {
      latestNote: sanitized.text,
    };
    if (updateContact) {
      updateData.lastContactAt = new Date();
    }

    await prisma.athlete.update({
      where: { id },
      data: updateData,
    });

    audit.logCreate("athleteNote", athleteNote.id, ctx.session.id, { note: sanitized.text, athleteId: id });
    return NextResponse.json(athleteNote, { status: 201 });
  } catch (error) {
    console.error("POST /api/athletes/:id/note error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "athletes", athleteIdSource: "params", athleteIdKey: "id" });
