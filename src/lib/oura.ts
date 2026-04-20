/**
 * Oura Ring API v2 — OAuth 2.0 integration
 * https://cloud.ouraring.com/v2/docs
 *
 * Flow:
 *   1. Redirect user to Oura authorization URL
 *   2. Oura redirects back with authorization code
 *   3. Exchange code for access + refresh tokens
 *   4. Use access token to fetch data from Oura API v2
 */

const OURA_AUTH_URL = "https://cloud.ouraring.com/oauth/authorize";
const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
const OURA_API_URL = "https://api.ouraring.com/v2/usercollection";

function getClientId(): string {
  const id = process.env.OURA_CLIENT_ID;
  if (!id) throw new Error("OURA_CLIENT_ID not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.OURA_CLIENT_SECRET;
  if (!secret) throw new Error("OURA_CLIENT_SECRET not set");
  return secret;
}

// ─── Step 1: Build authorization URL ───

export function getAuthorizationUrl(callbackUrl: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: callbackUrl,
    scope: "daily heartrate workout session sleep personal",
    state,
  });
  return `${OURA_AUTH_URL}?${params.toString()}`;
}

// ─── Step 2: Exchange code for tokens ───

export interface OuraTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function exchangeCodeForToken(
  code: string,
  callbackUrl: string
): Promise<OuraTokens> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Oura token exchange error:", res.status, text);
    throw new Error(`Oura token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// ─── Refresh token ───

export async function refreshAccessToken(refreshToken: string): Promise<OuraTokens> {
  const res = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Oura refresh token error:", res.status, text);
    throw new Error(`Oura refresh token failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// ─── API helpers ───

async function ouraGet(path: string, accessToken: string, params?: Record<string, string>): Promise<Response> {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return fetch(`${OURA_API_URL}${path}${qs}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

// ─── Data types ───

export interface OuraDailyActivity {
  id: string;
  day: string; // YYYY-MM-DD
  score: number;
  active_calories: number;
  steps: number;
  total_calories: number;
  equivalent_walking_distance: number;
  high_activity_time: number;
  medium_activity_time: number;
  low_activity_time: number;
  sedentary_time: number;
}

export interface OuraDailySleep {
  id: string;
  day: string;
  score: number;
  timestamp: string;
  contributors: {
    deep_sleep: number;
    efficiency: number;
    latency: number;
    rem_sleep: number;
    restfulness: number;
    timing: number;
    total_sleep: number;
  };
}

export interface OuraSleep {
  id: string;
  day: string;
  bedtime_start: string;
  bedtime_end: string;
  duration: number; // seconds
  total_sleep_duration: number;
  awake_time: number;
  light_sleep_duration: number;
  deep_sleep_duration: number;
  rem_sleep_duration: number;
  heart_rate: { interval: number; items: number[]; timestamp: string };
  hrv: { interval: number; items: number[]; timestamp: string };
  average_heart_rate: number;
  lowest_heart_rate: number;
  average_hrv: number;
  efficiency: number;
}

export interface OuraDailyReadiness {
  id: string;
  day: string;
  score: number;
  temperature_deviation: number;
  temperature_trend_deviation: number;
  contributors: {
    activity_balance: number;
    body_temperature: number;
    hrv_balance: number;
    previous_day_activity: number;
    previous_night: number;
    recovery_index: number;
    resting_heart_rate: number;
    sleep_balance: number;
  };
}

export interface OuraHeartRate {
  bpm: number;
  source: string;
  timestamp: string;
}

// ─── Data fetchers ───

/**
 * Fetch daily activity data.
 */
export async function getDailyActivity(
  accessToken: string,
  startDate: string, // YYYY-MM-DD
  endDate: string
): Promise<OuraDailyActivity[]> {
  try {
    const res = await ouraGet("/daily_activity", accessToken, {
      start_date: startDate,
      end_date: endDate,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Oura daily activity error:", err);
    return [];
  }
}

/**
 * Fetch daily sleep scores.
 */
export async function getDailySleep(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<OuraDailySleep[]> {
  try {
    const res = await ouraGet("/daily_sleep", accessToken, {
      start_date: startDate,
      end_date: endDate,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Oura daily sleep error:", err);
    return [];
  }
}

/**
 * Fetch detailed sleep sessions.
 */
export async function getSleep(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<OuraSleep[]> {
  try {
    const res = await ouraGet("/sleep", accessToken, {
      start_date: startDate,
      end_date: endDate,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Oura sleep error:", err);
    return [];
  }
}

/**
 * Fetch daily readiness scores.
 */
export async function getDailyReadiness(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<OuraDailyReadiness[]> {
  try {
    const res = await ouraGet("/daily_readiness", accessToken, {
      start_date: startDate,
      end_date: endDate,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Oura readiness error:", err);
    return [];
  }
}

/**
 * Fetch heart rate data.
 */
export async function getHeartRate(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<OuraHeartRate[]> {
  try {
    const res = await ouraGet("/heartrate", accessToken, {
      start_datetime: `${startDate}T00:00:00+00:00`,
      end_datetime: `${endDate}T23:59:59+00:00`,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (err) {
    console.error("Oura heart rate error:", err);
    return [];
  }
}

/**
 * Revoke token (Oura doesn't have a dedicated revoke endpoint,
 * but we can delete the connection from our side).
 */
export async function revokeToken(_accessToken: string): Promise<boolean> {
  // Oura has no public revoke endpoint. The user must revoke from the Oura app.
  return true;
}
