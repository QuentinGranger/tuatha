import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import { deregisterUser as deregisterGarmin } from "@/lib/garmin";
import { deleteUser as deletePolarUser } from "@/lib/polar";
import { decryptHealthTokens } from "@/lib/encryption";

/**
 * GET /api/athlete/health/connections
 * Returns all health app connections for the authenticated athlete.
 */
export async function GET() {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const connections = await prisma.healthAppConnection.findMany({
      where: { athleteUserId: session.id },
      select: {
        id: true,
        provider: true,
        status: true,
        scopes: true,
        lastSyncAt: true,
        lastSyncError: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error("GET /api/athlete/health/connections error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

/**
 * DELETE /api/athlete/health/connections
 * Disconnects a health app provider.
 * Body: { provider: "GARMIN" | "POLAR" | "WHOOP" | "OURA" }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { provider } = await request.json();
    if (!provider) {
      return NextResponse.json({ error: "Provider requis." }, { status: 400 });
    }

    const connection = await prisma.healthAppConnection.findUnique({
      where: { athleteUserId_provider: { athleteUserId: session.id, provider } },
    });

    if (!connection) {
      return NextResponse.json({ error: "Connexion introuvable." }, { status: 404 });
    }

    // Decrypt tokens for provider API calls
    const conn = decryptHealthTokens(connection as Record<string, unknown>) as typeof connection;

    // Deauthenticate on provider side
    if (conn.provider === "GARMIN" && conn.accessToken && conn.accessTokenSecret) {
      await deregisterGarmin(conn.accessToken, conn.accessTokenSecret).catch(() => {});
    }
    if (conn.provider === "POLAR" && conn.accessToken && conn.providerUserId) {
      await deletePolarUser(conn.accessToken, parseInt(conn.providerUserId)).catch(() => {});
    }
    // WHOOP and Oura: no server-side revoke needed, user revokes from their app

    // Delete associated data points
    await prisma.healthDataPoint.deleteMany({
      where: { connectionId: connection.id },
    });

    // Delete the connection record
    await prisma.healthAppConnection.delete({
      where: { id: connection.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/athlete/health/connections error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
