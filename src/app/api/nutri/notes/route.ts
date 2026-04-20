import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, nutriConsultNoteSchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    const notes = await (prisma as any).nutriConsultNote.findMany({
      where: { athleteId, proId: session.id },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(notes);
  } catch (error) {
    console.error("GET /api/nutri/notes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:notes" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const parsed = validateBody(sanitizeBody(await req.json()), nutriConsultNoteSchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    const note = await (prisma as any).nutriConsultNote.create({
      data: {
        athleteId: d.athleteId,
        proId: session.id,
        date: new Date(d.date),
        notePro: d.notePro,
        notePatient: d.notePatient,
        focus: d.focus,
      },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("POST /api/nutri/notes error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "nutri:notes" });
