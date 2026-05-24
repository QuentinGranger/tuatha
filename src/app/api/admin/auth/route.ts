// ─── Admin Authentication ───
// POST /api/admin/auth — Login
// DELETE /api/admin/auth — Logout
// GET /api/admin/auth — Check session

import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminCredentials,
  createAdminSession,
  destroyAdminSession,
  getAdminSession,
  getAdminCookieName,
  getAdminCookieOptions,
} from "@/lib/adminSession";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
    }

    if (!verifyAdminCredentials(email, password)) {
      // Delay to prevent timing attacks
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
      return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
    }

    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || undefined;
    const token = await createAdminSession(ip, userAgent);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(getAdminCookieName(), token, getAdminCookieOptions());

    console.log(`[ADMIN-AUTH] Login success from ${ip}`);
    return response;
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, email: session.email });
}

export async function DELETE(request: NextRequest) {
  const jar = request.cookies;
  const token = jar.get(getAdminCookieName())?.value;
  if (token) {
    await destroyAdminSession(token);
  }
  
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getAdminCookieName(), "", { path: "/", maxAge: 0 });
  return response;
}
