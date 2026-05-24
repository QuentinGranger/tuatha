import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { getDashboardPath } from "@/lib/specialites";

const PROTECTED_DASHBOARDS = ["/dashboard/coach", "/dashboard/kine", "/dashboard/medecin", "/dashboard/nutri"];
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ─── Allowed origins for CORS + CSRF ───

function getAllowedOrigin(): string {
  if (IS_PRODUCTION) {
    return process.env.NEXT_PUBLIC_APP_URL || "https://tuatha.pro";
  }
  return "http://localhost:3000";
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ─── Security headers applied to ALL responses ───

function applySecurityHeaders(response: NextResponse): NextResponse {
  // HSTS: enforce HTTPS for 1 year, include subdomains, allow preload
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict browser features
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // XSS protection (legacy browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    // Next.js requires unsafe-eval in dev; production uses strict inline only
    IS_PRODUCTION
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://maps.googleapis.com https://places.googleapis.com",
    "frame-src 'self' https://www.youtube.com https://youtube.com",
    "media-src 'self' blob: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  // Force HTTPS for all subresources (anti-MITM: prevents mixed content)
  if (IS_PRODUCTION) {
    cspDirectives.push("upgrade-insecure-requests");
  }

  response.headers.set("Content-Security-Policy", cspDirectives.join("; "));

  // ─── Cross-Origin Isolation (anti-MITM + anti-Spectre) ───

  // Prevent other sites from opening this page in a popup and accessing it
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  // Prevent other origins from reading our resources (fonts, images, scripts)
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ─── HTTPS redirect in production ───
  if (IS_PRODUCTION && request.headers.get("x-forwarded-proto") === "http") {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = "https:";
    return NextResponse.redirect(httpsUrl, 301);
  }

  // ─── CORS + CSRF for /api routes ───
  if (pathname.startsWith("/api")) {
    const origin = request.headers.get("origin");
    const allowed = getAllowedOrigin();

    // Handle CORS preflight (OPTIONS)
    if (method === "OPTIONS") {
      const preflight = new NextResponse(null, { status: 204 });
      preflight.headers.set("Access-Control-Allow-Origin", allowed);
      preflight.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      preflight.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      preflight.headers.set("Access-Control-Allow-Credentials", "true");
      preflight.headers.set("Access-Control-Max-Age", "86400");
      return preflight;
    }

    // CSRF: block mutating requests with wrong or missing Origin
    // Exception: Stripe webhook endpoint is called by Stripe servers (no browser origin)
    if (MUTATING_METHODS.has(method) && !pathname.startsWith("/api/payments/webhook")) {
      if (origin && origin !== allowed) {
        return NextResponse.json(
          { error: "Origine non autoris\u00e9e." },
          { status: 403 },
        );
      }
    }

    // Apply CORS headers to all API responses
    const response = applySecurityHeaders(NextResponse.next());
    response.headers.set("Access-Control-Allow-Origin", allowed);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
    return response;
  }

  // ─── Admin back-office protection ───
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const adminToken = request.cookies.get("tuatha_admin_session")?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return applySecurityHeaders(NextResponse.next());
  }

  // /dashboard/confirmation is always accessible (post-registration page)
  if (pathname.startsWith("/dashboard/confirmation")) {
    return applySecurityHeaders(NextResponse.next());
  }

  // /dashboard exact → redirect to home (no direct access)
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protected dashboard routes → check session cookie
  const isProtectedRoute = PROTECTED_DASHBOARDS.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtectedRoute) {
    // Try prefixed cookie (production), then old names, then legacy
    const session = (IS_PRODUCTION ? request.cookies.get("__Host-tuatha_access")?.value : null)
      || request.cookies.get("tuatha_access")?.value
      || request.cookies.get("tuatha_session")?.value;

    if (!session) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Session format: "token:specialite" (DB-backed session)
    const colonIdx = session.indexOf(":");
    const specialite = colonIdx !== -1 ? session.slice(colonIdx + 1) : null;

    if (!specialite) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    const allowedPath = getDashboardPath(specialite);

    // A pro can't access another pro's dashboard
    if (!pathname.startsWith(allowedPath)) {
      return NextResponse.redirect(new URL(allowedPath, request.url));
    }
  }

  // ─── i18n: set default locale cookie if missing ───
  const localeCookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!localeCookie || !locales.includes(localeCookie as Locale)) {
    const response = applySecurityHeaders(NextResponse.next());
    response.cookies.set(LOCALE_COOKIE, defaultLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
