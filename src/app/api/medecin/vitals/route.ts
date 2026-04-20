import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { validateBody, createVitalEntrySchema } from "@/lib/validation";
import { sanitizeBody } from "@/lib/sanitize";
import { canAccessVitals, logAccess } from "@/lib/privacyGuard";

export const GET = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const athleteId = req.nextUrl.searchParams.get("athleteId");
    if (!athleteId) return NextResponse.json({ error: "athleteId requis" }, { status: 400 });

    // Optional: filter by vitalKey
    const vitalKey = req.nextUrl.searchParams.get("vitalKey");
    // Optional: limit (default 50)
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

    // Privacy: athlete may have disabled vitals sharing
    if (!await canAccessVitals(athleteId, session.id)) {
      logAccess(athleteId, session.id, "view_vitals", { blocked: true });
      return NextResponse.json({ error: "L'athlète a désactivé le partage des constantes vitales." }, { status: 403 });
    }
    logAccess(athleteId, session.id, "view_vitals");

    const where: Record<string, unknown> = { athleteId, proId: session.id };
    if (vitalKey) where.vitalKey = vitalKey;

    const entries = await (prisma as any).medVitalEntry.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      take: limit,
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/medecin/vitals error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:vitals" });

export const POST = withAuth(async (req, ctx) => {
  try {
    const session = ctx.session;
    const parsed = validateBody(sanitizeBody(await req.json()), createVitalEntrySchema);
    if (!parsed.success) return parsed.errorResponse;
    const d = parsed.data;

    // Privacy: athlete may have disabled vitals sharing
    if (!await canAccessVitals(d.athleteId, session.id)) {
      logAccess(d.athleteId, session.id, "view_vitals", { blocked: true });
      return NextResponse.json({ error: "L'athlète a désactivé le partage des constantes vitales." }, { status: 403 });
    }

    const entry = await (prisma as any).medVitalEntry.create({
      data: {
        athleteId: d.athleteId,
        proId: session.id,
        vitalKey: d.vitalKey,
        value: d.value,
        unit: d.unit,
        note: d.note || null,
        recordedAt: d.recordedAt ? new Date(d.recordedAt) : new Date(),
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("POST /api/medecin/vitals error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "medecin:vitals" });
