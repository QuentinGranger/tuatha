import { secrets } from "@/lib/vault";
import { createOAuthState } from "@/lib/webhook";

const OUTLOOK_CLIENT_ID = secrets.outlookClientId();
const OUTLOOK_CLIENT_SECRET = secrets.outlookClientSecret();
const OUTLOOK_REDIRECT_URI = secrets.outlookRedirectUri();

const OUTLOOK_AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const OUTLOOK_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export function getOutlookAuthUrl(professionnelId: string) {
  const params = new URLSearchParams({
    client_id: OUTLOOK_CLIENT_ID,
    redirect_uri: OUTLOOK_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile Calendars.ReadWrite offline_access",
    state: createOAuthState(professionnelId),
    response_mode: "query",
  });

  return `${OUTLOOK_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeOutlookCode(code: string) {
  const res = await fetch(OUTLOOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: OUTLOOK_CLIENT_ID,
      client_secret: OUTLOOK_CLIENT_SECRET,
      redirect_uri: OUTLOOK_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Outlook token exchange failed: ${error}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  }>;
}

export async function getOutlookUser(accessToken: string) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error("Failed to get Outlook user");

  const data = await res.json();
  return data as { mail?: string; userPrincipalName: string; displayName: string };
}
