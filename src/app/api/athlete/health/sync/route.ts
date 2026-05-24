import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionAthlete } from "@/lib/session";
import {
  getDailySummaries as garminDailies,
  getSleepSummaries as garminSleep,
} from "@/lib/garmin";
import {
  getDailyActivity as polarActivity,
  getSleepData as polarSleep,
} from "@/lib/polar";
import {
  getCycles as whoopCycles,
  getRecoveries as whoopRecoveries,
  getSleep as whoopSleep,
  refreshAccessToken as whoopRefresh,
} from "@/lib/whoop";
import {
  getDailyActivity as ouraActivity,
  getSleep as ouraSleep,
  getDailyReadiness as ouraReadiness,
  refreshAccessToken as ouraRefresh,
} from "@/lib/oura";
import { encrypt, decryptHealthTokens } from "@/lib/encryption";

/**
 * POST /api/athlete/health/sync
 * Manually triggers data sync for all connected providers.
 * Pulls the last 7 days of data.
 */
export async function POST() {
  try {
    const session = await getSessionAthlete();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const connections = await prisma.healthAppConnection.findMany({
      where: { athleteUserId: session.id, status: "connected" },
    });

    if (connections.length === 0) {
      return NextResponse.json({ synced: 0, message: "Aucun appareil connecté." });
    }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startDateStr = weekAgo.toISOString().slice(0, 10);
    const endDateStr = now.toISOString().slice(0, 10);
    const startUnix = Math.floor(weekAgo.getTime() / 1000);
    const endUnix = Math.floor(now.getTime() / 1000);

    let totalPoints = 0;

    for (const connRaw of connections) {
      const conn = decryptHealthTokens(connRaw as Record<string, unknown>) as typeof connRaw;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const points: any[] = [];

        // ─── GARMIN ───
        if (conn.provider === "GARMIN" && conn.accessToken && conn.accessTokenSecret) {
          const dailies = await garminDailies(conn.accessToken, conn.accessTokenSecret, startUnix, endUnix);
          for (const d of dailies) {
            const date = new Date(d.calendarDate + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            if (d.steps != null) points.push({ ...base, category: "steps", value: d.steps, unit: "count" });
            if (d.totalKilocalories != null) points.push({ ...base, category: "calories", value: d.totalKilocalories, unit: "kcal" });
            if (d.totalDistanceInMeters != null) points.push({ ...base, category: "distance", value: +(d.totalDistanceInMeters / 1000).toFixed(2), unit: "km" });
            if (d.activeTimeInSeconds != null) points.push({ ...base, category: "active_minutes", value: Math.round(d.activeTimeInSeconds / 60), unit: "min" });
            if (d.averageHeartRateInBeatsPerMinute != null) points.push({ ...base, category: "heart_rate", value: d.averageHeartRateInBeatsPerMinute, unit: "bpm", metadata: { resting: d.restingHeartRateInBeatsPerMinute, max: d.maxHeartRateInBeatsPerMinute } });
            if (d.averageStressLevel != null) points.push({ ...base, category: "stress", value: d.averageStressLevel, unit: "score" });
          }

          const sleeps = await garminSleep(conn.accessToken, conn.accessTokenSecret, startUnix, endUnix);
          for (const s of sleeps) {
            const date = new Date(s.calendarDate + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            if (s.durationInSeconds != null) points.push({ ...base, category: "sleep", value: +(s.durationInSeconds / 3600).toFixed(2), unit: "hours", metadata: { deep: s.deepSleepDurationInSeconds, light: s.lightSleepDurationInSeconds, rem: s.remSleepInSeconds, score: s.overallSleepScore?.value } });
          }
        }

        // ─── POLAR ───
        if (conn.provider === "POLAR" && conn.accessToken) {
          const activities = await polarActivity(conn.accessToken);
          for (const a of activities) {
            const date = new Date(a.date + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            if (a.active_steps != null) points.push({ ...base, category: "steps", value: a.active_steps, unit: "count" });
            if (a.active_calories != null) points.push({ ...base, category: "calories", value: a.active_calories, unit: "kcal" });
          }

          const sleepData = await polarSleep(conn.accessToken);
          for (const s of sleepData) {
            const date = new Date(s.date + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            const totalSleep = (s.light_sleep + s.deep_sleep + s.rem_sleep) / 3600;
            points.push({ ...base, category: "sleep", value: +totalSleep.toFixed(2), unit: "hours", metadata: { light: s.light_sleep, deep: s.deep_sleep, rem: s.rem_sleep, score: s.sleep_score } });
          }
        }

        // ─── WHOOP ───
        if (conn.provider === "WHOOP" && conn.accessToken) {
          let token = conn.accessToken;

          // Refresh token if expired
          if (conn.tokenExpiresAt && new Date() > conn.tokenExpiresAt && conn.refreshToken) {
            try {
              const refreshed = await whoopRefresh(conn.refreshToken);
              token = refreshed.accessToken;
              await prisma.healthAppConnection.update({
                where: { id: conn.id },
                data: {
                  accessToken: encrypt(refreshed.accessToken),
                  refreshToken: encrypt(refreshed.refreshToken),
                  tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
                },
              });
            } catch {
              console.error("WHOOP token refresh failed for", conn.id);
              await prisma.healthAppConnection.update({ where: { id: conn.id }, data: { lastSyncError: "Token refresh failed" } });
              continue;
            }
          }

          const startISO = weekAgo.toISOString();
          const endISO = now.toISOString();

          const cycles = await whoopCycles(token, startISO, endISO);
          for (const c of cycles) {
            const date = new Date(c.start.slice(0, 10) + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            if (c.score) {
              points.push({ ...base, category: "calories", value: Math.round(c.score.kilojoule / 4.184), unit: "kcal" });
              points.push({ ...base, category: "heart_rate", value: c.score.average_heart_rate, unit: "bpm", metadata: { max: c.score.max_heart_rate, strain: c.score.strain } });
              points.push({ ...base, category: "stress", value: c.score.strain, unit: "score" });
            }
          }

          const recoveries = await whoopRecoveries(token, startISO, endISO);
          for (const r of recoveries) {
            if (!r.score) continue;
            const matchedCycle = cycles.find((c) => c.id === r.cycle_id);
            const dateStr = matchedCycle ? matchedCycle.start.slice(0, 10) : now.toISOString().slice(0, 10);
            const date = new Date(dateStr + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            points.push({ ...base, category: "hrv", value: r.score.hrv_rmssd_milli, unit: "ms" });
            if (r.score.spo2_percentage) points.push({ ...base, category: "spo2", value: r.score.spo2_percentage, unit: "%" });
          }

          const sleepData = await whoopSleep(token, startISO, endISO);
          for (const s of sleepData) {
            const date = new Date(s.start.slice(0, 10) + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            if (s.score?.stage_summary) {
              const totalMs = s.score.stage_summary.total_in_bed_time_milli - s.score.stage_summary.total_awake_time_milli;
              points.push({ ...base, category: "sleep", value: +(totalMs / 3600000).toFixed(2), unit: "hours", metadata: { performance: s.score.sleep_performance_percentage, efficiency: s.score.sleep_efficiency_percentage, deep: s.score.stage_summary.total_slow_wave_sleep_time_milli / 60000, rem: s.score.stage_summary.total_rem_sleep_time_milli / 60000, light: s.score.stage_summary.total_light_sleep_time_milli / 60000 } });
            }
          }
        }

        // ─── OURA ───
        if (conn.provider === "OURA" && conn.accessToken) {
          let token = conn.accessToken;

          // Refresh token if expired
          if (conn.tokenExpiresAt && new Date() > conn.tokenExpiresAt && conn.refreshToken) {
            try {
              const refreshed = await ouraRefresh(conn.refreshToken);
              token = refreshed.accessToken;
              await prisma.healthAppConnection.update({
                where: { id: conn.id },
                data: {
                  accessToken: encrypt(refreshed.accessToken),
                  refreshToken: encrypt(refreshed.refreshToken),
                  tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
                },
              });
            } catch {
              console.error("Oura token refresh failed for", conn.id);
              await prisma.healthAppConnection.update({ where: { id: conn.id }, data: { lastSyncError: "Token refresh failed" } });
              continue;
            }
          }

          const activities = await ouraActivity(token, startDateStr, endDateStr);
          for (const a of activities) {
            const date = new Date(a.day + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            if (a.steps != null) points.push({ ...base, category: "steps", value: a.steps, unit: "count" });
            if (a.active_calories != null) points.push({ ...base, category: "calories", value: a.active_calories, unit: "kcal" });
            if (a.equivalent_walking_distance != null) points.push({ ...base, category: "distance", value: +(a.equivalent_walking_distance / 1000).toFixed(2), unit: "km" });
            if (a.high_activity_time != null) points.push({ ...base, category: "active_minutes", value: Math.round((a.high_activity_time + a.medium_activity_time) / 60), unit: "min" });
          }

          const sleepData = await ouraSleep(token, startDateStr, endDateStr);
          for (const s of sleepData) {
            const date = new Date(s.day + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            if (s.total_sleep_duration != null) points.push({ ...base, category: "sleep", value: +(s.total_sleep_duration / 3600).toFixed(2), unit: "hours", metadata: { deep: s.deep_sleep_duration / 60, light: s.light_sleep_duration / 60, rem: s.rem_sleep_duration / 60, efficiency: s.efficiency, avgHr: s.average_heart_rate, lowestHr: s.lowest_heart_rate, avgHrv: s.average_hrv } });
            if (s.average_heart_rate != null) points.push({ ...base, category: "heart_rate", value: s.average_heart_rate, unit: "bpm", metadata: { lowest: s.lowest_heart_rate } });
            if (s.average_hrv != null) points.push({ ...base, category: "hrv", value: s.average_hrv, unit: "ms" });
          }

          const readiness = await ouraReadiness(token, startDateStr, endDateStr);
          for (const r of readiness) {
            const date = new Date(r.day + "T00:00:00.000Z");
            const base = { connectionId: conn.id, athleteUserId: conn.athleteUserId, date };
            if (r.temperature_deviation != null) points.push({ ...base, category: "body_temperature", value: +r.temperature_deviation.toFixed(2), unit: "°C", metadata: { readiness_score: r.score, contributors: r.contributors } });
          }
        }

        // ─── Upsert all points ───
        for (const dp of points) {
          await prisma.healthDataPoint.upsert({
            where: {
              connectionId_category_date: {
                connectionId: dp.connectionId,
                category: dp.category,
                date: dp.date,
              },
            },
            create: dp,
            update: { value: dp.value, metadata: dp.metadata || undefined },
          });
        }

        if (points.length > 0) {
          await prisma.healthAppConnection.update({
            where: { id: conn.id },
            data: { lastSyncAt: new Date(), lastSyncError: null },
          });
        }

        totalPoints += points.length;
        console.log(`Sync ${conn.provider}: ${points.length} points for athlete ${session.id}`);
      } catch (err) {
        console.error(`Sync error for ${conn.provider}:`, err);
        await prisma.healthAppConnection.update({
          where: { id: conn.id },
          data: { lastSyncError: `Sync failed: ${(err as Error).message}` },
        });
      }
    }

    return NextResponse.json({ synced: totalPoints, providers: connections.map((c) => c.provider) });
  } catch (error) {
    console.error("POST /api/athlete/health/sync error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
