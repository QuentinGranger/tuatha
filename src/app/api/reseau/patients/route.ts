import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { signAvatarPaths } from "@/lib/signedUrl";

// GET /api/reseau/patients — returns all my athletes with their connected professionals
export const GET = withAuth(async (_req, ctx) => {
  try {
    const session = ctx.session;

    // Get all my athletes
    const athletes = await (prisma as any).athlete.findMany({
      where: { professionnelId: session.id, status: "active" },
      select: {
        id: true,
        name: true,
        sport: true,
        bodyZone: true,
        motif: true,
        injuryNote: true,
        riskLevel: true,
        trend: true,
        contactEmail: true,
        contactPhone: true,
        createdAt: true,
      },
      orderBy: { name: "asc" },
    });

    // For each athlete, find connections (by matching name across pros)
    const proSelect = { id: true, nom: true, prenom: true, specialite: true, avatarPath: true };

    const result = await Promise.all(
      athletes.map(async (athlete: any) => {
        // Find all athlete records with same name (cross-pro dedup)
        const sameNameAthletes = await (prisma as any).athlete.findMany({
          where: { name: { equals: athlete.name, mode: "insensitive" } },
          select: { id: true },
        });
        const athleteIds = sameNameAthletes.map((a: any) => a.id);

        // Find all connections for this patient
        const connections = await (prisma as any).proConnection.findMany({
          where: {
            athleteId: { in: athleteIds },
            status: "connecte",
          },
          include: {
            ownerPro: { select: proSelect },
            connectedPro: { select: proSelect },
          },
        });

        // Build unique list of other pros (exclude myself)
        const prosMap = new Map<string, any>();
        for (const conn of connections) {
          if (conn.ownerPro.id !== session.id) prosMap.set(conn.ownerPro.id, conn.ownerPro);
          if (conn.connectedPro.id !== session.id) prosMap.set(conn.connectedPro.id, conn.connectedPro);
        }

        return {
          ...athlete,
          connectedPros: Array.from(prosMap.values()),
          connectionCount: prosMap.size,
        };
      })
    );

    return NextResponse.json(signAvatarPaths(result));
  } catch (error) {
    console.error("GET /api/reseau/patients error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "reseau" });
