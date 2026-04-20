import { google } from "googleapis";
import { secrets } from "@/lib/vault";
import { createOAuthState } from "@/lib/webhook";

const GOOGLE_CLIENT_ID = secrets.googleClientId();
const GOOGLE_CLIENT_SECRET = secrets.googleClientSecret();
const GOOGLE_REDIRECT_URI = secrets.googleRedirectUri();

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(professionnelId: string) {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state: createOAuthState(professionnelId),
  });
}
