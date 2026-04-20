/**
 * Polar Accesslink API — OAuth 2.0 integration
 * https://www.polar.com/accesslink-api/
 *
 * Flow:
 *   1. Redirect user to Polar authorization URL
 *   2. Polar redirects back with authorization code
 *   3. Exchange code for access token
 *   4. Use access token to fetch data from Accesslink API
 */

const POLAR_AUTH_URL = "https://flow.polar.com/oauth2/authorization";
const POLAR_TOKEN_URL = "https://polarremote.com/v2/oauth2/token";
const POLAR_API_URL = "https://www.polaraccesslink.com/v3";

function getClientId(): string {
  const id = process.env.POLAR_CLIENT_ID;
  if (!id) throw new Error("POLAR_CLIENT_ID not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.POLAR_CLIENT_SECRET;
  if (!secret) throw new Error("POLAR_CLIENT_SECRET not set");
  return secret;
}

// ─── Step 1: Build authorization URL ───

export function getAuthorizationUrl(callbackUrl: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: callbackUrl,
    scope: "accesslink.read_all",
  });
  return `${POLAR_AUTH_URL}?${params.toString()}`;
}

// ─── Step 2: Exchange code for tokens ───

export interface PolarTokens {
  accessToken: string;
  tokenType: string;
  polarUserId: number;
}

export async function exchangeCodeForToken(
  code: string,
  callbackUrl: string
): Promise<PolarTokens> {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(POLAR_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Polar token exchange error:", res.status, text);
    throw new Error(`Polar token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    polarUserId: data.x_user_id,
  };
}

// ─── Register user with Accesslink ───

export async function registerUser(
  accessToken: string,
  polarUserId: number
): Promise<boolean> {
  try {
    const res = await fetch(`${POLAR_API_URL}/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ "member-id": polarUserId.toString() }),
    });
    // 200 = registered, 409 = already registered — both are OK
    return res.ok || res.status === 409;
  } catch (err) {
    console.error("Polar register user error:", err);
    return false;
  }
}

// ─── Data fetchers ───

export interface PolarDailyActivity {
  date: string;
  active_calories: number;
  active_steps: number;
  duration: string; // ISO 8601 duration
}

export interface PolarSleep {
  date: string;
  sleep_start_time: string;
  sleep_end_time: string;
  device_id: string;
  continuity: number;
  continuity_class: number;
  light_sleep: number;
  deep_sleep: number;
  rem_sleep: number;
  total_interruption_duration: number;
  sleep_charge: number;
  sleep_score: number;
}

export interface PolarExercise {
  id: string;
  upload_time: string;
  polar_user: string;
  device: string;
  start_time: string;
  duration: string;
  calories: number;
  distance: number;
  heart_rate: { average: number; maximum: number };
  sport: string;
  detailed_sport_info: string;
}

/**
 * Fetch daily activity data from Polar Accesslink.
 * Note: Polar uses a transaction-based model for daily activity.
 */
export async function getDailyActivity(accessToken: string): Promise<PolarDailyActivity[]> {
  try {
    // Create transaction
    const txRes = await fetch(`${POLAR_API_URL}/users/daily-activity`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!txRes.ok) {
      if (txRes.status === 204) return []; // No new data
      return [];
    }

    const tx = await txRes.json();
    const activities: PolarDailyActivity[] = [];

    // Get activity summaries from transaction
    if (tx["activity-log"]) {
      for (const url of tx["activity-log"]) {
        const actRes = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        if (actRes.ok) activities.push(await actRes.json());
      }
    }

    // Commit transaction
    if (tx["transaction-id"]) {
      await fetch(`${POLAR_API_URL}/users/daily-activity/${tx["transaction-id"]}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    return activities;
  } catch (err) {
    console.error("Polar daily activity error:", err);
    return [];
  }
}

/**
 * Fetch sleep data from Polar Accesslink.
 */
export async function getSleepData(accessToken: string): Promise<PolarSleep[]> {
  try {
    const res = await fetch(`${POLAR_API_URL}/users/sleep-data`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.nights || [];
  } catch (err) {
    console.error("Polar sleep data error:", err);
    return [];
  }
}

/**
 * Fetch exercise data from Polar Accesslink (transaction-based).
 */
export async function getExercises(accessToken: string): Promise<PolarExercise[]> {
  try {
    // Create transaction
    const txRes = await fetch(`${POLAR_API_URL}/users/exercise-transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!txRes.ok) {
      if (txRes.status === 204) return [];
      return [];
    }

    const tx = await txRes.json();
    const exercises: PolarExercise[] = [];

    if (tx.exercises) {
      for (const url of tx.exercises) {
        const exRes = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        });
        if (exRes.ok) exercises.push(await exRes.json());
      }
    }

    // Commit transaction
    if (tx["transaction-id"]) {
      await fetch(`${POLAR_API_URL}/users/exercise-transactions/${tx["transaction-id"]}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }

    return exercises;
  } catch (err) {
    console.error("Polar exercises error:", err);
    return [];
  }
}

/**
 * Delete user registration (revoke access).
 */
export async function deleteUser(accessToken: string, polarUserId: number): Promise<boolean> {
  try {
    const res = await fetch(`${POLAR_API_URL}/users/${polarUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok || res.status === 204;
  } catch (err) {
    console.error("Polar delete user error:", err);
    return false;
  }
}
