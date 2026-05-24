import { NextResponse } from "next/server";
import { getSessionPro } from "@/lib/session";
import { getSessionAthlete } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/visio/ice-servers
// Returns ICE server configuration (STUN + TURN) for WebRTC.
// Requires authentication (pro or athlete session).
//
// Supports two TURN modes:
//   1. Metered.ca API  — set METERED_API_KEY (ephemeral credentials, recommended)
//   2. Static creds    — set TURN_SERVER_URL + TURN_USERNAME + TURN_CREDENTIAL

export async function GET() {
  // Require any authenticated session (pro or athlete)
  const proSession = await getSessionPro();
  const athleteSession = proSession ? null : await getSessionAthlete();
  if (!proSession && !athleteSession) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // Mode 1: Metered.ca — fetch ephemeral TURN credentials via their API
  const meteredApiKey = process.env.METERED_API_KEY;
  if (meteredApiKey) {
    try {
      const res = await fetch(
        `https://tuatha.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`,
        { next: { revalidate: 0 } },
      );
      if (res.ok) {
        const creds = await res.json();
        if (Array.isArray(creds) && creds.length > 0) {
          iceServers.push(...creds);
          return NextResponse.json({ iceServers });
        }
      }
    } catch {
      // Fall through to static config or STUN-only
    }
  }

  // Mode 2: Static TURN credentials from env
  const turnUrl = process.env.TURN_SERVER_URL;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return NextResponse.json({ iceServers });
}
