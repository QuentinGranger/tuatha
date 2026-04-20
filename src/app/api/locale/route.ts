import { NextRequest, NextResponse } from "next/server";
import { locales, LOCALE_COOKIE, type Locale } from "@/i18n/config";

// POST /api/locale  { locale: "en" | "fr" }
export async function POST(request: NextRequest) {
  try {
    const { locale } = await request.json();

    if (!locale || !locales.includes(locale as Locale)) {
      return NextResponse.json(
        { error: "Invalid locale. Supported: " + locales.join(", ") },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ locale, ok: true });
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
