import { secrets } from "@/lib/vault";
import { createOAuthState } from "@/lib/webhook";

const CALENDLY_CLIENT_ID = secrets.calendlyClientId();
const CALENDLY_CLIENT_SECRET = secrets.calendlyClientSecret();
const CALENDLY_REDIRECT_URI = secrets.calendlyRedirectUri();

const CALENDLY_AUTH_BASE = "https://auth.calendly.com/oauth/authorize";
const CALENDLY_TOKEN_URL = "https://auth.calendly.com/oauth/token";

export function getCalendlyAuthUrl(professionnelId: string) {
  const params = new URLSearchParams({
    client_id: CALENDLY_CLIENT_ID,
    redirect_uri: CALENDLY_REDIRECT_URI,
    response_type: "code",
    state: createOAuthState(professionnelId),
  });

  return `${CALENDLY_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeCalendlyCode(code: string) {
  const res = await fetch(CALENDLY_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CALENDLY_CLIENT_ID,
      client_secret: CALENDLY_CLIENT_SECRET,
      redirect_uri: CALENDLY_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Calendly token exchange failed: ${error}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

export async function getCalendlyUser(accessToken: string) {
  const res = await fetch("https://api.calendly.com/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error("Failed to get Calendly user");

  const data = await res.json();
  return data.resource as { email: string; name: string; uri: string };
}
