import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, clearAuthCookies } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST() {
  // Revoke DB session (access token)
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (raw) {
      const token = raw.split(":")[0];
      if (token) {
        await prisma.authSession.updateMany({
          where: { token, revoked: false },
          data: { revoked: true, revokedAt: new Date(), revokedReason: "logout" },
        });
      }
    }
  } catch (err) {
    console.error("[Logout] Error revoking session:", err);
  }

  const response = NextResponse.json({ message: "Déconnexion réussie" });

  clearAuthCookies(response);

  return response;
}
