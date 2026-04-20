/**
 * WHOOP Developer API — OAuth 2.0 integration
 * https://developer.whoop.com/
 *
 * Flow:
 *   1. Redirect user to WHOOP authorization URL
 *   2. WHOOP redirects back with authorization code
 *   3. Exchange code for access + refresh tokens
 *   4. Use access token to fetch data from WHOOP API
 */

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API_URL = "https://api.prod.whoop.com/developer/v1";

function getClientId(): string {
  const id = process.env.WHOOP_CLIENT_ID;
  if (!id) throw new Error("WHOOP_CLIENT_ID not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.WHOOP_CLIENT_SECRET;
  if (!secret) throw new Error("WHOOP_CLIENT_SECRET not set");
  return secret;
}

// ─── Step 1: Build authorization URL ───

export function getAuthorizationUrl(callbackUrl: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: callbackUrl,
    scope: "read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement",
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

// ─── Step 2: Exchange code for tokens ───

export interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  whoopUserId: string;
}

export async function exchangeCodeForToken(
  code: string,
  callbackUrl: string
): Promise<WhoopTokens> {
  const res = await fetch(WHOOP_TOKEN_URL, {
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
    console.error("WHOOP token exchange error:", res.status, text);
    throw new Error(`WHOOP token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    whoopUserId: data.user_id?.toString() || "",
  };
}

// ─── Refresh token ───

export async function refreshAccessToken(refreshToken: string): Promise<WhoopTokens> {
  const res = await fetch(WHOOP_TOKEN_URL, {
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
    console.error("WHOOP refresh token error:", res.status, text);
    throw new Error(`WHOOP refresh token failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    whoopUserId: data.user_id?.toString() || "",
  };
}

// ─── API helpers ───

async function whoopGet(path: string, accessToken: string): Promise<Response> {
  return fetch(`${WHOOP_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
}

// ─── Data fetchers ───

export interface WhoopCycle {
  id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

export interface WhoopRecovery {
  cycle_id: number;
  created_at: string;
  updated_at: string;
  score: {
    recovery_score: number; // 0-100
    resting_heart_rate: number;
    hrv_rmssd_milli: number; // HRV in ms
    spo2_percentage: number;
    skin_temp_celsius: number;
  };
}

export interface WhoopSleep {
  id: number;
  created_at: string;
  start: string;
  end: string;
  score: {
    stage_summary: {
      total_in_bed_time_milli: number;
      total_awake_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
      sleep_cycle_count: number;
      disturbance_count: number;
    };
    sleep_needed: { baseline_milli: number; need_from_sleep_debt_milli: number };
    sleep_performance_percentage: number;
    sleep_consistency_percentage: number;
    sleep_efficiency_percentage: number;
  };
}

export interface WhoopWorkout {
  id: number;
  created_at: string;
  start: string;
  end: string;
  sport_id: number;
  score: {
    strain: number;
    average_heart_rate: number;
    max_heart_rate: number;
    kilojoule: number;
    distance_meter?: number;
  };
}

/**
 * Fetch recent cycles (daily physiological data).
 */
export async function getCycles(
  accessToken: string,
  startDate: string, // YYYY-MM-DDTHH:mm:ss.sssZ
  endDate: string
): Promise<WhoopCycle[]> {
  try {
    const params = new URLSearchParams({ start: startDate, end: endDate, limit: "25" });
    const res = await whoopGet(`/cycle?${params}`, accessToken);
    if (!res.ok) return [];
    const data = await res.json();
    return data.records || [];
  } catch (err) {
    console.error("WHOOP cycles error:", err);
    return [];
  }
}

/**
 * Fetch recent recovery scores.
 */
export async function getRecoveries(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<WhoopRecovery[]> {
  try {
    const params = new URLSearchParams({ start: startDate, end: endDate, limit: "25" });
    const res = await whoopGet(`/recovery?${params}`, accessToken);
    if (!res.ok) return [];
    const data = await res.json();
    return data.records || [];
  } catch (err) {
    console.error("WHOOP recovery error:", err);
    return [];
  }
}

/**
 * Fetch recent sleep data.
 */
export async function getSleep(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<WhoopSleep[]> {
  try {
    const params = new URLSearchParams({ start: startDate, end: endDate, limit: "25" });
    const res = await whoopGet(`/activity/sleep?${params}`, accessToken);
    if (!res.ok) return [];
    const data = await res.json();
    return data.records || [];
  } catch (err) {
    console.error("WHOOP sleep error:", err);
    return [];
  }
}

/**
 * Fetch recent workouts.
 */
export async function getWorkouts(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<WhoopWorkout[]> {
  try {
    const params = new URLSearchParams({ start: startDate, end: endDate, limit: "25" });
    const res = await whoopGet(`/activity/workout?${params}`, accessToken);
    if (!res.ok) return [];
    const data = await res.json();
    return data.records || [];
  } catch (err) {
    console.error("WHOOP workouts error:", err);
    return [];
  }
}

/**
 * Get body measurements.
 */
export async function getBodyMeasurement(accessToken: string): Promise<{
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
} | null> {
  try {
    const res = await whoopGet("/body_measurement", accessToken);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("WHOOP body measurement error:", err);
    return null;
  }
}
