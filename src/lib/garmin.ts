/**
 * Garmin Health API — OAuth 1.0a integration
 * https://developer.garmin.com/gc-developer-program/overview/
 *
 * Flow:
 *   1. Get request token (POST /oauth-service/oauth/request_token)
 *   2. Redirect user to Garmin auth page
 *   3. Garmin redirects back with oauth_verifier
 *   4. Exchange for access token (POST /oauth-service/oauth/access_token)
 *   5. Use access token to fetch data from Health API endpoints
 */

import crypto from "crypto";

const GARMIN_BASE = "https://connectapi.garmin.com";
const GARMIN_REQUEST_TOKEN_URL = `${GARMIN_BASE}/oauth-service/oauth/request_token`;
const GARMIN_AUTHORIZE_URL = "https://connect.garmin.com/oauthConfirm";
const GARMIN_ACCESS_TOKEN_URL = `${GARMIN_BASE}/oauth-service/oauth/access_token`;

// ─── Health API endpoints ───

const GARMIN_HEALTH_API = "https://apis.garmin.com/wellness-api/rest";

// ─── OAuth 1.0a helpers ───

function getConsumerKey(): string {
  const key = process.env.GARMIN_CONSUMER_KEY;
  if (!key) throw new Error("GARMIN_CONSUMER_KEY not set");
  return key;
}

function getConsumerSecret(): string {
  const secret = process.env.GARMIN_CONSUMER_SECRET;
  if (!secret) throw new Error("GARMIN_CONSUMER_SECRET not set");
  return secret;
}

function percentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

function generateTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

function buildBaseString(
  method: string,
  url: string,
  params: Record<string, string>
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
  return `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
}

function signRequest(
  baseString: string,
  consumerSecret: string,
  tokenSecret: string = ""
): string {
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
}

function buildAuthHeader(params: Record<string, string>): string {
  const parts = Object.keys(params)
    .filter((k) => k.startsWith("oauth_"))
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(params[k])}"`)
    .join(", ");
  return `OAuth ${parts}`;
}

// ─── Step 1: Get Request Token ───

export interface RequestTokenResult {
  oauthToken: string;
  oauthTokenSecret: string;
  authorizeUrl: string;
}

export async function getRequestToken(callbackUrl: string): Promise<RequestTokenResult> {
  const consumerKey = getConsumerKey();
  const consumerSecret = getConsumerSecret();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: generateTimestamp(),
    oauth_nonce: generateNonce(),
    oauth_version: "1.0",
    oauth_callback: callbackUrl,
  };

  const baseString = buildBaseString("POST", GARMIN_REQUEST_TOKEN_URL, oauthParams);
  oauthParams.oauth_signature = signRequest(baseString, consumerSecret);

  const authHeader = buildAuthHeader(oauthParams);

  const res = await fetch(GARMIN_REQUEST_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Garmin request token error:", res.status, text);
    throw new Error(`Garmin request token failed: ${res.status}`);
  }

  const body = await res.text();
  const parsed = new URLSearchParams(body);
  const oauthToken = parsed.get("oauth_token");
  const oauthTokenSecret = parsed.get("oauth_token_secret");

  if (!oauthToken || !oauthTokenSecret) {
    throw new Error("Garmin request token: missing oauth_token or oauth_token_secret");
  }

  const authorizeUrl = `${GARMIN_AUTHORIZE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`;

  return { oauthToken, oauthTokenSecret, authorizeUrl };
}

// ─── Step 2: Exchange for Access Token ───

export interface AccessTokenResult {
  accessToken: string;
  accessTokenSecret: string;
}

export async function getAccessToken(
  oauthToken: string,
  oauthTokenSecret: string,
  oauthVerifier: string
): Promise<AccessTokenResult> {
  const consumerKey = getConsumerKey();
  const consumerSecret = getConsumerSecret();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: oauthToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: generateTimestamp(),
    oauth_nonce: generateNonce(),
    oauth_version: "1.0",
    oauth_verifier: oauthVerifier,
  };

  const baseString = buildBaseString("POST", GARMIN_ACCESS_TOKEN_URL, oauthParams);
  oauthParams.oauth_signature = signRequest(baseString, consumerSecret, oauthTokenSecret);

  const authHeader = buildAuthHeader(oauthParams);

  const res = await fetch(GARMIN_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Garmin access token error:", res.status, text);
    throw new Error(`Garmin access token failed: ${res.status}`);
  }

  const body = await res.text();
  const parsed = new URLSearchParams(body);
  const accessToken = parsed.get("oauth_token");
  const accessTokenSecret = parsed.get("oauth_token_secret");

  if (!accessToken || !accessTokenSecret) {
    throw new Error("Garmin access token: missing tokens in response");
  }

  return { accessToken, accessTokenSecret };
}

// ─── Make authenticated API requests ───

function signedGetRequest(
  url: string,
  accessToken: string,
  accessTokenSecret: string,
  queryParams: Record<string, string> = {}
): { headers: Record<string, string>; fullUrl: string } {
  const consumerKey = getConsumerKey();
  const consumerSecret = getConsumerSecret();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: generateTimestamp(),
    oauth_nonce: generateNonce(),
    oauth_version: "1.0",
  };

  // Merge query params for signature
  const allParams = { ...oauthParams, ...queryParams };
  const baseString = buildBaseString("GET", url, allParams);
  oauthParams.oauth_signature = signRequest(baseString, consumerSecret, accessTokenSecret);

  const authHeader = buildAuthHeader(oauthParams);
  const qs = Object.keys(queryParams).length > 0
    ? "?" + new URLSearchParams(queryParams).toString()
    : "";

  return { headers: { Authorization: authHeader }, fullUrl: `${url}${qs}` };
}

// ─── Health API data fetchers ───

export interface GarminDailySummary {
  calendarDate: string;
  steps: number;
  totalDistanceInMeters: number;
  activeTimeInSeconds: number;
  floorsClimbed: number;
  minHeartRateInBeatsPerMinute: number;
  maxHeartRateInBeatsPerMinute: number;
  averageHeartRateInBeatsPerMinute: number;
  restingHeartRateInBeatsPerMinute: number;
  averageStressLevel: number;
  bodyBatteryChargedValue: number;
  bodyBatteryDrainedValue: number;
  totalKilocalories: number;
  activeKilocalories: number;
  bmrKilocalories: number;
  moderateIntensityDurationInSeconds: number;
  vigorousIntensityDurationInSeconds: number;
}

export interface GarminSleepSummary {
  calendarDate: string;
  durationInSeconds: number;
  deepSleepDurationInSeconds: number;
  lightSleepDurationInSeconds: number;
  remSleepInSeconds: number;
  awakeDurationInSeconds: number;
  averageSpO2Value: number;
  overallSleepScore?: { value: number };
}

export interface GarminActivitySummary {
  activityId: number;
  activityName: string;
  activityType: string;
  startTimeInSeconds: number;
  durationInSeconds: number;
  distanceInMeters: number;
  activeKilocalories: number;
  averageHeartRateInBeatsPerMinute: number;
  maxHeartRateInBeatsPerMinute: number;
  averageRunningCadenceInStepsPerMinute?: number;
  maxRunningCadenceInStepsPerMinute?: number;
}

/**
 * Fetch daily summaries from Garmin Health API.
 * @param uploadStartTimeInSeconds - UNIX timestamp (start of range)
 * @param uploadEndTimeInSeconds - UNIX timestamp (end of range)
 */
export async function getDailySummaries(
  accessToken: string,
  accessTokenSecret: string,
  uploadStartTimeInSeconds: number,
  uploadEndTimeInSeconds: number
): Promise<GarminDailySummary[]> {
  const url = `${GARMIN_HEALTH_API}/dailies`;
  const params = {
    uploadStartTimeInSeconds: uploadStartTimeInSeconds.toString(),
    uploadEndTimeInSeconds: uploadEndTimeInSeconds.toString(),
  };

  const { headers, fullUrl } = signedGetRequest(url, accessToken, accessTokenSecret, params);

  try {
    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
      console.error("Garmin dailies error:", res.status, await res.text());
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("Garmin dailies fetch error:", err);
    return [];
  }
}

/**
 * Fetch sleep summaries from Garmin Health API.
 */
export async function getSleepSummaries(
  accessToken: string,
  accessTokenSecret: string,
  uploadStartTimeInSeconds: number,
  uploadEndTimeInSeconds: number
): Promise<GarminSleepSummary[]> {
  const url = `${GARMIN_HEALTH_API}/sleeps`;
  const params = {
    uploadStartTimeInSeconds: uploadStartTimeInSeconds.toString(),
    uploadEndTimeInSeconds: uploadEndTimeInSeconds.toString(),
  };

  const { headers, fullUrl } = signedGetRequest(url, accessToken, accessTokenSecret, params);

  try {
    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
      console.error("Garmin sleep error:", res.status, await res.text());
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("Garmin sleep fetch error:", err);
    return [];
  }
}

/**
 * Fetch activity summaries from Garmin Health API.
 */
export async function getActivitySummaries(
  accessToken: string,
  accessTokenSecret: string,
  uploadStartTimeInSeconds: number,
  uploadEndTimeInSeconds: number
): Promise<GarminActivitySummary[]> {
  const url = `${GARMIN_HEALTH_API}/activities`;
  const params = {
    uploadStartTimeInSeconds: uploadStartTimeInSeconds.toString(),
    uploadEndTimeInSeconds: uploadEndTimeInSeconds.toString(),
  };

  const { headers, fullUrl } = signedGetRequest(url, accessToken, accessTokenSecret, params);

  try {
    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
      console.error("Garmin activities error:", res.status, await res.text());
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error("Garmin activities fetch error:", err);
    return [];
  }
}

/**
 * Deregister a user (revoke access).
 */
export async function deregisterUser(
  accessToken: string,
  accessTokenSecret: string
): Promise<boolean> {
  const consumerKey = getConsumerKey();
  const consumerSecret = getConsumerSecret();
  const url = `${GARMIN_HEALTH_API}/user/registration`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: generateTimestamp(),
    oauth_nonce: generateNonce(),
    oauth_version: "1.0",
  };

  const baseString = buildBaseString("DELETE", url, oauthParams);
  oauthParams.oauth_signature = signRequest(baseString, consumerSecret, accessTokenSecret);

  const authHeader = buildAuthHeader(oauthParams);

  try {
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: authHeader },
    });
    return res.ok;
  } catch (err) {
    console.error("Garmin deregister error:", err);
    return false;
  }
}
