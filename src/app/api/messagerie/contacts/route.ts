import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/withAuth";
import { signAvatarUrl } from "@/lib/signedUrl";

// GET /api/messagerie/contacts — returns athletes + connected pros for the contact directory
export const GET = withAuth(async (_req, ctx) => {
  try {
    const session = ctx.session;

    const proSelect = { id: true, nom: true, prenom: true, specialite: true, avatarPath: true, email: true, telephone: true };

    // 1. My athletes (manual records)
    const athletes: any[] = await (prisma as any).athlete.findMany({
      where: { professionnelId: session.id, status: "active" },
      select: {
        id: true,
        name: true,
        sport: true,
        contactEmail: true,
        contactPhone: true,
        bodyZone: true,
        motif: true,
      },
      orderBy: { name: "asc" },
    });

    // 1b. Connected AthleteUser (self-registered athletes with accepted connection)
    const existingNames = new Set(athletes.map((a: any) => a.name.trim().toLowerCase()));
    const connectedAthleteUsers = await (prisma as any).connectionRequest.findMany({
      where: { professionnelId: session.id, status: "accepted" },
      include: {
        athleteUser: {
          select: { id: true, nom: true, prenom: true, sport: true, email: true, avatarPath: true },
        },
      },
    });
    for (const conn of connectedAthleteUsers) {
      const au = conn.athleteUser;
      if (!au) continue;
      const fullName = `${au.prenom} ${au.nom}`;
      if (existingNames.has(fullName.trim().toLowerCase())) continue;
      existingNames.add(fullName.trim().toLowerCase());
      athletes.push({
        id: au.id,
        name: fullName,
        sport: au.sport || null,
        contactEmail: au.email || null,
        contactPhone: null,
        bodyZone: null,
        motif: null,
        avatarUrl: signAvatarUrl(au.avatarPath),
        _source: "athlete_user",
      });
    }
    athletes.sort((a: any, b: any) => a.name.localeCompare(b.name));

    // 2. Connected professionals (from all my connections)
    const [connectionsAsOwner, connectionsAsConnected] = await Promise.all([
      (prisma as any).proConnection.findMany({
        where: { ownerProId: session.id, status: "connecte" },
        include: { connectedPro: { select: proSelect }, athlete: { select: { name: true } } },
      }),
      (prisma as any).proConnection.findMany({
        where: { connectedProId: session.id, status: "connecte" },
        include: { ownerPro: { select: proSelect }, athlete: { select: { name: true } } },
      }),
    ]);

    // Build unique pro map with their linked athletes
    const proMap = new Map<string, { pro: any; athletes: string[] }>();

    for (const conn of connectionsAsOwner) {
      const pro = conn.connectedPro;
      if (!proMap.has(pro.id)) proMap.set(pro.id, { pro, athletes: [] });
      if (conn.athlete?.name) proMap.get(pro.id)!.athletes.push(conn.athlete.name);
    }

    for (const conn of connectionsAsConnected) {
      const pro = conn.ownerPro;
      if (!proMap.has(pro.id)) proMap.set(pro.id, { pro, athletes: [] });
      if (conn.athlete?.name) proMap.get(pro.id)!.athletes.push(conn.athlete.name);
    }

    // Deduplicate athlete names per pro
    const professionals = Array.from(proMap.values()).map((entry) => ({
      ...entry.pro,
      linkedAthletes: [...new Set(entry.athletes)],
    }));

    // Sort pros alphabetically
    professionals.sort((a: any, b: any) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`));

    return NextResponse.json({ athletes, professionals });
  } catch (error) {
    console.error("GET /api/messagerie/contacts error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { resource: "messagerie" });
